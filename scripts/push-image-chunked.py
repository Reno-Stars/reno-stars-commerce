#!/usr/bin/env python3
"""Push a docker-save image using bounded Registry V2 PATCH requests.

Large monolithic uploads through the registry proxy returned HTTP 524.
Keep requests sequential and <=4 MiB; preserve/verify each layer's diff ID.
Credentials only go to the same HTTPS origin's advertised token endpoint.
"""
import base64
import gzip
import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CHUNK = 4 * 1024 * 1024
MANIFEST = 'application/vnd.docker.distribution.manifest.v2+json'


def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Registry:
    def __init__(self, host, repository):
        self.origin = 'https://' + host
        self.repository = repository
        self.token = None
        self.opener = urllib.request.build_opener(NoRedirect)

    def url(self, path):
        url = urllib.parse.urljoin(self.origin + '/', path)
        if urllib.parse.urlsplit(url).netloc != urllib.parse.urlsplit(self.origin).netloc or not url.startswith(self.origin + '/'):
            raise RuntimeError('Refusing cross-origin registry credential request')
        return url

    def raw(self, method, path, data=None, headers=None):
        headers = dict(headers or {})
        headers['User-Agent'] = 'reno-stars-registry-uploader/1'
        request = urllib.request.Request(self.url(path), data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=90) as response:
                return response.status, response.headers, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.headers, error.read()

    def authenticate(self):
        code, headers, _ = self.raw('GET', '/v2/')
        if code != 401:
            raise RuntimeError('Expected registry token challenge')
        challenge = headers.get('WWW-Authenticate', '')
        if not challenge.startswith('Bearer '):
            raise RuntimeError('Expected Bearer registry authentication')
        fields = dict(re.findall(r'(\w+)="([^"]*)"', challenge))
        realm = self.url(fields['realm'])
        query = urllib.parse.urlencode({'service': fields['service'], 'scope': 'repository:' + self.repository + ':pull,push'})
        auth = base64.b64encode((os.environ['REGISTRY_USERNAME'] + ':' + os.environ['REGISTRY_PASSWORD']).encode()).decode()
        code, _, body = self.raw('GET', realm + ('&' if '?' in realm else '?') + query, headers={'Authorization': 'Basic ' + auth})
        if code != 200:
            raise RuntimeError('Registry token exchange failed: HTTP ' + str(code))
        result = json.loads(body)
        self.token = result.get('token') or result.get('access_token')
        if not self.token:
            raise RuntimeError('Registry did not issue a token')

    def request(self, method, path, data=None, headers=None):
        if not self.token:
            self.authenticate()
        headers = dict(headers or {})
        for attempt in range(2):
            headers['Authorization'] = 'Bearer ' + self.token
            result = self.raw(method, path, data, headers)
            if result[0] != 401 or attempt:
                return result
            self.authenticate()

    def blob(self, data):
        sha = digest(data)
        endpoint = '/v2/' + self.repository + '/blobs/' + sha
        code, _, _ = self.request('HEAD', endpoint)
        if code == 200:
            print('Existing blob', sha, flush=True)
            return sha
        if code != 404:
            raise RuntimeError('Blob lookup failed: HTTP ' + str(code))
        # Restart an interrupted upload instead of blindly replaying a PATCH:
        # the server may have accepted bytes before a proxy lost its response.
        for attempt in range(3):
            location = None
            try:
                code, headers, _ = self.request('POST', '/v2/' + self.repository + '/blobs/uploads/', b'')
                if code != 202:
                    raise RuntimeError('Upload start HTTP ' + str(code))
                location = self.url(headers['Location'])
                for offset in range(0, len(data), CHUNK):
                    chunk = data[offset:offset + CHUNK]
                    code, headers, _ = self.request('PATCH', location, chunk, {
                        'Content-Type': 'application/octet-stream',
                        'Content-Range': str(offset) + '-' + str(offset + len(chunk) - 1),
                    })
                    if code != 202:
                        raise RuntimeError('Upload chunk HTTP ' + str(code))
                    location = self.url(headers['Location'])
                sep = '&' if '?' in location else '?'
                code, _, _ = self.request('PUT', location + sep + urllib.parse.urlencode({'digest': sha}), b'')
                if code != 201:
                    raise RuntimeError('Upload completion HTTP ' + str(code))
                code, _, _ = self.request('HEAD', endpoint)
                if code != 200:
                    raise RuntimeError('Uploaded blob verification failed')
                print('Uploaded blob', sha, len(data), 'bytes', flush=True)
                return sha
            except (RuntimeError, OSError) as error:
                if location:
                    try:
                        self.request('DELETE', location)
                    except OSError:
                        pass
                if attempt == 2:
                    raise RuntimeError('Blob upload failed after three attempts') from error
                print('Restarting blob upload attempt', attempt + 2, flush=True)
                time.sleep(3)


def image_manifest(archive, registry):
    with tarfile.open(archive) as tar:
        def read(name):
            member = tar.getmember(name)
            if not member.isfile():
                raise RuntimeError('Expected regular archive member')
            return tar.extractfile(member).read()
        entries = json.loads(read('manifest.json'))
        if len(entries) != 1:
            raise RuntimeError('Expected exactly one saved image')
        entry = entries[0]
        config = read(entry['Config'])
        expected = json.loads(config)['rootfs']['diff_ids']
        if len(expected) != len(entry['Layers']):
            raise RuntimeError('Layer count mismatch')
        layers = []
        for path, diff_id in zip(entry['Layers'], expected):
            data = read(path)
            raw = gzip.decompress(data) if data[:2] == b'\x1f\x8b' else data
            if digest(raw) != diff_id:
                raise RuntimeError('Saved layer does not match image config')
            compressed = data if data[:2] == b'\x1f\x8b' else gzip.compress(raw, compresslevel=6, mtime=0)
            sha = registry.blob(compressed)
            layers.append({'mediaType': 'application/vnd.docker.image.rootfs.diff.tar.gzip', 'size': len(compressed), 'digest': sha})
        config_sha = registry.blob(config)
        return json.dumps({'schemaVersion': 2, 'mediaType': MANIFEST,
            'config': {'mediaType': 'application/vnd.docker.container.image.v1+json', 'size': len(config), 'digest': config_sha},
            'layers': layers}, separators=(',', ':')).encode()


def main(image):
    if not re.fullmatch(r'registry\.enteros\.ai/reno-stars/medusa-(backend|storefront):[a-f0-9]{12}', image):
        raise RuntimeError('Expected a commit-tagged commerce image')
    host, rest = image.split('/', 1)
    repository, tag = rest.rsplit(':', 1)
    registry = Registry(host, repository)
    with tempfile.TemporaryDirectory(prefix='commerce-image-') as folder:
        archive = Path(folder) / 'image.tar'
        subprocess.run(['docker', 'save', '-o', str(archive), image], check=True)
        manifest = image_manifest(archive, registry)
        endpoint = '/v2/' + repository + '/manifests/' + tag
        code, _, _ = registry.request('PUT', endpoint, manifest, {'Content-Type': MANIFEST})
        if code != 201:
            raise RuntimeError('Manifest publication failed: HTTP ' + str(code))
        code, _, body = registry.request('GET', endpoint, headers={'Accept': MANIFEST})
        if code != 200 or digest(body) != digest(manifest):
            raise RuntimeError('Published manifest digest mismatch')
        print('Verified image', image, digest(manifest), flush=True)


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except Exception as error:
        # Never dump request headers, token-bearing locations or response bodies.
        print('Image upload failed:', type(error).__name__, str(error) if isinstance(error, RuntimeError) else '', file=sys.stderr)
        sys.exit(1)
