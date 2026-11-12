import XCTest

/// Exercises the installed simulator app, not a test-host or a mocked startup.
/// Use a fresh, dedicated simulator: no wallet fixture or launch bypass is used.
final class StartupSmokeTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.debank.rabby-mobile-regression")
    private let welcomeIdentifier = "e2e.onboarding.welcome.import-existing"

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    override func tearDownWithError() throws {
        attachScreen(named: "final-screen")
        app.terminate()
    }

    func testTwoColdStartsReachInteractiveWelcome() {
        for attempt in 1...2 {
            XCTContext.runActivity(named: "Cold start \(attempt)") { _ in
                app.terminate()
                XCTAssertTrue(app.wait(for: .notRunning, timeout: 10), "App did not terminate")
                app.launch()
                defer { attachScreen(named: "cold-start-\(attempt)") }

                XCTAssertTrue(
                    app.wait(for: .runningForeground, timeout: 30),
                    "App did not reach foreground"
                )

                let welcome = app.descendants(matching: .any)
                    .matching(identifier: welcomeIdentifier).firstMatch
                XCTAssertTrue(
                    welcome.waitForExistence(timeout: 60),
                    "The real onboarding screen did not render"
                )

                let ready = XCTNSPredicateExpectation(
                    predicate: NSPredicate(format: "hittable == true AND enabled == true"),
                    object: welcome
                )
                XCTAssertEqual(
                    XCTWaiter.wait(for: [ready], timeout: 20), .completed,
                    "The onboarding action did not become interactive"
                )

                // A launch PID alone can precede a dyld/native crash. Observe
                // the actual rendered UI and process throughout this interval.
                let deadline = ProcessInfo.processInfo.systemUptime + 10
                repeat {
                    XCTAssertEqual(app.state, .runningForeground, "App left foreground after startup")
                    XCTAssertTrue(welcome.exists && welcome.isHittable && welcome.isEnabled,
                                  "The interactive onboarding screen disappeared")
                    Thread.sleep(forTimeInterval: 1)
                } while ProcessInfo.processInfo.systemUptime < deadline
                XCTAssertEqual(app.state, .runningForeground)
                XCTAssertTrue(welcome.exists && welcome.isHittable && welcome.isEnabled)
            }
        }
    }

    private func attachScreen(named name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
