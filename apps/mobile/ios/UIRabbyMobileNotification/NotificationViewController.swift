//
//  NotificationViewController.swift
//  UIRabbyMobileNotification
//
//  Created by WorkRichard on 2026/1/23.
//

import UIKit
import UserNotifications
import UserNotificationsUI
import UniformTypeIdentifiers

class NotificationViewController: UIViewController, UNNotificationContentExtension {
  @IBOutlet weak var imageView: UIImageView!
  @IBOutlet weak var titleLabel: UILabel!
  @IBOutlet weak var subtitleLabel: UILabel!
  @IBOutlet weak var badgeImageView: UIImageView!

  override func viewDidLoad() {
    super.viewDidLoad()

    // 设置背景颜色为透明
    self.preferredContentSize = CGSize(width: 320, height: 100)

    // 圆角卡片样式
    let backgroundView = UIView()
    backgroundView.backgroundColor = UIColor.white.withAlphaComponent(0.8)
    backgroundView.layer.cornerRadius = 15
    view.addSubview(backgroundView)
    backgroundView.translatesAutoresizingMaskIntoConstraints = false
    //    NSLayoutConstraint.activate([
    //      backgroundView.topAnchor.constraint(equalTo: view.topAnchor),
    //      backgroundView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
    //      backgroundView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    //      backgroundView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    //    ])

    // 设置imageView的约束以保持1:1比例
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.layer.cornerRadius = 15
    imageView.layer.masksToBounds = true

    // 角标小图
    badgeImageView.contentMode = .scaleAspectFit
    badgeImageView.layer.cornerRadius = 5
    badgeImageView.layer.masksToBounds = true
  }

  func didReceive(_ notification: UNNotification) {
    let content = notification.request.content

    // 设置标题和副标题
    titleLabel.text = content.title
    subtitleLabel.text = content.body ?? content.subtitle

    // // 加载图片
    // if let attachment = content.attachments.first,
    //   attachment.url.startAccessingSecurityScopedResource()
    // {
    //   do {
    //     let imageData = try Data(contentsOf: attachment.url)
    //     imageView.image = UIImage(data: imageData)

    //     // // 假设你有一个固定的角标图片路径
    //     // if let badgeImage = UIImage(named: "badgeIcon") {
    //     //   badgeImageView.image = badgeImage
    //     // }
    //   } catch {
    //     print("Error loading image from attachment")
    //   }
    //   attachment.url.stopAccessingSecurityScopedResource()
    if let urlString = content.userInfo["imageUrl"] as? String,
      let url = URL(string: urlString), url.scheme == "https" {
      downloadAttachment(from: url) { attachment in
        if let attachment = attachment {

          do {
            let imageData = try Data(contentsOf: attachment.url)
            let img = UIImage(data: imageData)
            DispatchQueue.main.async {
              self.imageView.image = img
            }

            // // 假设你有一个固定的角标图片路径
            // if let badgeImage = UIImage(named: "badgeIcon") {
            //   badgeImageView.image = badgeImage
            // }
          } catch {
            print("Error loading image from attachment")
          }
        }
      }
    } else {
      // No image or invalid URL, directly show the original notification
    }
  }

  private func downloadAttachment(
    from url: URL, completion: @escaping (UNNotificationAttachment?) -> Void
  ) {
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
          let utType = UTType(mimeType: mimeType)?.identifier
        {
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
