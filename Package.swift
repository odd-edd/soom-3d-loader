// swift-tools-version:5.9
// Lives at the repo root because Swift Package Manager resolves packages from
// the root of a git repository. Sources are under ios/.
import PackageDescription

let package = Package(
    name: "Soom",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "Soom", targets: ["Soom"]),
    ],
    targets: [
        .target(name: "Soom", path: "ios/Sources/Soom"),
        .testTarget(
            name: "SoomTests",
            dependencies: ["Soom"],
            path: "ios/Tests/SoomTests"
        ),
    ]
)
