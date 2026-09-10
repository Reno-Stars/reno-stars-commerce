import Foundation
import Vision
import ImageIO
let folder=CommandLine.arguments[1]
let names=try FileManager.default.contentsOfDirectory(atPath:folder).filter{$0.hasSuffix(".jpg")}.sorted()
for name in names {
 do {
  let url=URL(fileURLWithPath:folder).appendingPathComponent(name)
  let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=false;request.recognitionLanguages=["en-US"]
  try VNImageRequestHandler(url:url,options:[:]).perform([request])
  let rows=(request.results ?? []).compactMap{ o -> [String:Any]? in guard let text=o.topCandidates(1).first else{return nil};return ["text":text.string,"confidence":text.confidence,"x":o.boundingBox.minX,"y":o.boundingBox.minY,"w":o.boundingBox.width,"h":o.boundingBox.height] }
  let out:[String:Any] = ["file":name,"lines":rows]
  let data=try JSONSerialization.data(withJSONObject:out,options:[.sortedKeys]);print(String(data:data,encoding:.utf8)!);fflush(stdout)
 } catch {print("{\"file\":\"\(name)\",\"error\":\"OCR failed\"}")}
}
