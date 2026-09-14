import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('uploader', Path(__file__).parents[1] / 'push-image-chunked.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)


class FakeRegistry(u.Registry):
    def __init__(self):
        super().__init__('registry.enteros.ai', 'reno-stars/medusa-backend')
        self.uploads = {}
        self.blobs = {}
        self.starts = 0
        self.failed_once = False
        self.max_chunk = 0

    def raw(self, method, path, data=None, headers=None):
        from urllib.parse import urlsplit, parse_qs
        path = self.url(path)
        if path.endswith('/v2/'):
            return 401, {'WWW-Authenticate': 'Bearer realm="https://registry.enteros.ai/v2/token",service="container_registry"'}, b''
        if '/v2/token?' in path:
            assert headers['Authorization'].startswith('Basic ')
            assert parse_qs(urlsplit(path).query)['scope'] == ['repository:reno-stars/medusa-backend:pull,push']
            return 200, {}, b'{"token":"test-token"}'
        assert headers['Authorization'] == 'Bearer test-token'
        if method == 'HEAD':
            return (200 if path.rsplit('/', 1)[-1] in self.blobs else 404), {}, b''
        if method == 'POST':
            self.starts += 1
            location = self.origin + '/v2/reno-stars/medusa-backend/blobs/uploads/' + str(self.starts)
            self.uploads[location] = bytearray()
            return 202, {'Location': location}, b''
        if method == 'PATCH':
            start, end = map(int, headers['Content-Range'].split('-'))
            assert start == len(self.uploads[path])
            assert end == start + len(data) - 1
            self.max_chunk = max(self.max_chunk, len(data))
            self.uploads[path].extend(data)
            if not self.failed_once:
                self.failed_once = True
                return 524, {}, b''  # Accepted bytes, lost response.
            return 202, {'Location': path}, b''
        if method == 'DELETE':
            self.uploads.pop(path)
            return 204, {}, b''
        if method == 'PUT':
            location = path.split('?', 1)[0]
            sha = parse_qs(urlsplit(path).query)['digest'][0]
            body = bytes(self.uploads.pop(location))
            assert u.digest(body) == sha
            self.blobs[sha] = body
            return 201, {}, b''
        raise AssertionError(method)


class UploadTests(unittest.TestCase):
    @patch.dict(os.environ, {'REGISTRY_USERNAME': 'test', 'REGISTRY_PASSWORD': 'test'})
    @patch.object(u, 'CHUNK', 128)
    @patch.object(u.time, 'sleep', lambda _: None)
    def test_image_and_ambiguous_chunk_restart(self):
        raw = os.urandom(2048)
        config = json.dumps({'rootfs': {'diff_ids': [u.digest(raw)]}}).encode()
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'image.tar'
            with tarfile.open(archive, 'w') as tar:
                for name, data in [('layer.tar', raw), ('config.json', config), ('manifest.json', json.dumps([{'Config': 'config.json', 'Layers': ['layer.tar']}]).encode())]:
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    tar.addfile(member, io.BytesIO(data))
            registry = FakeRegistry()
            manifest = json.loads(u.image_manifest(archive, registry))
            self.assertEqual(manifest['config']['digest'], u.digest(config))
            self.assertEqual(u.gzip.decompress(registry.blobs[manifest['layers'][0]['digest']]), raw)
            self.assertEqual(registry.starts, 3)  # Restart + layer + config.
            self.assertLessEqual(registry.max_chunk, 128)
            registry.blob(config)
            self.assertEqual(registry.starts, 3)  # Existing blobs are reused.

    def test_rejects_foreign_and_plaintext_locations(self):
        registry = FakeRegistry()
        for url in ['http://registry.enteros.ai/upload', 'https://evil.example/upload', 'https://registry.enteros.ai.evil.example/upload']:
            with self.assertRaises(RuntimeError):
                registry.url(url)

    def test_bad_layer_fails_before_upload(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'image.tar'
            with tarfile.open(archive, 'w') as tar:
                for name, data in [('layer.tar', b'corrupt'), ('config.json', json.dumps({'rootfs': {'diff_ids': [u.digest(b'expected')]}}).encode()), ('manifest.json', b'[{"Config":"config.json","Layers":["layer.tar"]}]')]:
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    tar.addfile(member, io.BytesIO(data))
            registry = FakeRegistry()
            with self.assertRaisesRegex(RuntimeError, 'does not match'):
                u.image_manifest(archive, registry)
            self.assertEqual(registry.starts, 0)


if __name__ == '__main__':
    unittest.main()
