//
//  NotificationViewController.swift
//  UIRabbyMobileNotification
//
//  Created by WorkRichard on 2026/1/23.
//

import UIKit
import UserNotifications
import UserNotificationsUI

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
    NSLayoutConstraint.activate([
      backgroundView.topAnchor.constraint(equalTo: view.topAnchor),
      backgroundView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      backgroundView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      backgroundView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])

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
    subtitleLabel.text = content.subtitle

    // 加载图片
    if let attachment = content.attachments.first,
      attachment.url.startAccessingSecurityScopedResource()
    {
      do {
        let imageData = try Data(contentsOf: attachment.url)
        imageView.image = UIImage(data: imageData)

        // 假设你有一个固定的角标图片路径
        if let badgeImage = UIImage(named: "badgeIcon") {
          badgeImageView.image = badgeImage
        }
      } catch {
        print("Error loading image from attachment")
      }
      attachment.url.stopAccessingSecurityScopedResource()
    }
  }
}
