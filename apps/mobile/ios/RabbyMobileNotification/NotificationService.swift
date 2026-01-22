//
//  NotificationService.swift
//  RabbyMobileNotification
//
//  Created by WorkRichard on 2026/1/23.
//

import UserNotifications
import UniformTypeIdentifiers

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        if let bestAttemptContent = bestAttemptContent {
            // Read image URL from custom field (field name can be customized, here we use "imageUrl")
            if let urlString = request.content.userInfo["imageUrl"] as? String,
               let url = URL(string: urlString),
               url.scheme == "https" { // Strongly recommend only allowing HTTPS

                downloadAttachment(from: url) { attachment in
                    if let attachment = attachment {
                        bestAttemptContent.attachments = [attachment]
                    }
                    contentHandler(bestAttemptContent)
                }
            } else {
                // No image or invalid URL, directly show the original notification
                contentHandler(bestAttemptContent)
            }
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // The system is about to terminate the extension (about 30 seconds timeout), return the current content immediately
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    private func downloadAttachment(from url: URL, completion: @escaping (UNNotificationAttachment?) -> Void) {
        let task = URLSession.shared.downloadTask(with: url) { [weak self] localURL, response, error in
            guard let localURL = localURL, error == nil else {
                completion(nil)
                return
            }

            // Get file extension (used for system to recognize type)
            let originalFileName = url.lastPathComponent
            let tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory())
            let tempFile = tempDirectory.appendingPathComponent(originalFileName)

            do {
                // Move to a temporary directory (required because downloadTask provides a temporary file)
                try FileManager.default.moveItem(at: localURL, to: tempFile)

                // Create attachment (identifier can be empty)
                let attachment = try UNNotificationAttachment(
                    identifier: "",
                    url: tempFile,
                    options: nil
                )
                completion(attachment)
            } catch {
                // If the file extension is missing or unrecognized, you can manually specify the MIME type (e.g., .jpg)
                // Example: handling a case where there's no extension but it's actually a JPEG
                if let mimeType = self?.mimeType(for: url),
                   let utType = UTType(mimeType: mimeType)?.identifier {
                    let options = [UNNotificationAttachmentOptionsTypeHintKey: utType]
                    do {
                        let attachment = try UNNotificationAttachment(
                            identifier: "",
                            url: tempFile,
                            options: options
                        )
                        completion(attachment)
                        return
                    } catch {
                        // Still failed
                        // TODO: Handle error if needed
                    }
                }
                completion(nil)
            }
        }
        task.resume()
    }

    // Helper function to guess MIME type based on URL (optional enhancement)
    private func mimeType(for url: URL) -> String? {
        let pathExt = url.pathExtension.lowercased()
        switch pathExt {
        case "jpg", "jpeg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "gif":
            return "image/gif"
        case "heic":
            return "image/heic"
        default:
            return nil
        }
    }
}
