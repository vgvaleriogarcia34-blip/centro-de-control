import Foundation
import Capacitor
import Photos
import PhotosUI
import UniformTypeIdentifiers

// Selector de fotos de Recuerdo.
//
// El selector estándar de iOS entrega copias SIN ubicación salvo que el usuario toque
// «Opciones → Ubicación». Aquí, con permiso de la fototeca, leemos cada foto original
// (PHAsset): llega con su GPS, su fecha y la orientación de la brújula en el EXIF.
// Sin permiso, se usa la copia del selector como hasta ahora.
@objc(RecuerdoPhotosPlugin)
public class RecuerdoPhotosPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "RecuerdoPhotosPlugin"
    public let jsName = "RecuerdoPhotos"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private var pendingCall: CAPPluginCall?

    private var importDir: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("recuerdo-import", isDirectory: true)
    }

    @objc func pick(_ call: CAPPluginCall) {
        pendingCall = call
        let limit = call.getInt("limit") ?? 0
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
            DispatchQueue.main.async { self.presentPicker(limit: limit) }
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        try? FileManager.default.removeItem(at: importDir)
        call.resolve()
    }

    private func presentPicker(limit: Int) {
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .images
        config.selectionLimit = limit
        config.preferredAssetRepresentationMode = .current
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        bridge?.viewController?.present(picker, animated: true)
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pendingCall else { return }
        pendingCall = nil
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        let access = status == .authorized ? "full" : status == .limited ? "limited" : "none"

        DispatchQueue.global(qos: .userInitiated).async {
            try? FileManager.default.createDirectory(at: self.importDir, withIntermediateDirectories: true)
            var photos: [[String: Any]] = []
            for (i, result) in results.enumerated() {
                if let item = self.export(result, useLibrary: access != "none") { photos.append(item) }
                self.notifyListeners("progress", data: ["done": i + 1, "total": results.count])
            }
            call.resolve(["photos": photos, "libraryAccess": access])
        }
    }

    // Devuelve { path, webPath, name, mime, source, lat?, lon?, takenAt? } o nil si no se pudo leer.
    private func export(_ result: PHPickerResult, useLibrary: Bool) -> [String: Any]? {
        if useLibrary, let id = result.assetIdentifier,
           let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject,
           let item = exportOriginal(asset) {
            return item
        }
        return exportPickerCopy(result)
    }

    private func exportOriginal(_ asset: PHAsset) -> [String: Any]? {
        let options = PHImageRequestOptions()
        options.isSynchronous = true
        options.isNetworkAccessAllowed = true // fotos que solo están en iCloud
        options.version = .current
        var data: Data?
        var uti: String?
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { d, u, _, _ in
            data = d
            uti = u
        }
        guard let bytes = data else { return nil }
        let type = uti.flatMap { UTType($0) }
        let ext = type?.preferredFilenameExtension ?? "jpg"
        let url = importDir.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
        guard (try? bytes.write(to: url)) != nil else { return nil }

        var item = describe(url, mime: type?.preferredMIMEType ?? "image/jpeg", source: "library")
        item["name"] = PHAssetResource.assetResources(for: asset).first?.originalFilename ?? url.lastPathComponent
        // Respaldo por si el EXIF no trae GPS o fecha (fotos editadas, capturas).
        if let loc = asset.location {
            item["lat"] = loc.coordinate.latitude
            item["lon"] = loc.coordinate.longitude
        }
        if let date = asset.creationDate {
            item["takenAt"] = ISO8601DateFormatter().string(from: date)
        }
        return item
    }

    private func exportPickerCopy(_ result: PHPickerResult) -> [String: Any]? {
        let provider = result.itemProvider
        let typeId = provider.registeredTypeIdentifiers.first { UTType($0)?.conforms(to: .image) == true } ?? UTType.image.identifier
        let done = DispatchSemaphore(value: 0)
        var copied: URL?
        provider.loadFileRepresentation(forTypeIdentifier: typeId) { url, _ in
            defer { done.signal() }
            guard let url = url else { return }
            let ext = url.pathExtension.isEmpty ? "jpg" : url.pathExtension
            let dest = self.importDir.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
            if (try? FileManager.default.copyItem(at: url, to: dest)) != nil { copied = dest }
        }
        done.wait()
        guard let file = copied else { return nil }
        var item = describe(file, mime: UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "image/jpeg", source: "picker")
        item["name"] = provider.suggestedName.map { "\($0).\(file.pathExtension)" } ?? file.lastPathComponent
        return item
    }

    private func describe(_ url: URL, mime: String, source: String) -> [String: Any] {
        [
            "path": url.path,
            "webPath": bridge?.portablePath(fromLocalURL: url)?.absoluteString ?? "",
            "mime": mime,
            "source": source,
        ]
    }
}

// Controlador principal: el de Capacitor, más nuestro plugin registrado.
class RecuerdoViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RecuerdoPhotosPlugin())
    }
}
