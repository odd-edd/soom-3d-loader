// swift-tools-version:5.9
// Lives at the repo root because Swift Package Manager resolves packages from
// the root of a git repository. Sources are under ios/.
import PackageDescription

let package = Package(
    name: "Soom3DLoader",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "Soom3DLoader", targets: ["Soom3DLoader"]),
    ],
    targets: [
        .target(name: "Soom3DLoader", path: "ios/Sources/Soom3DLoader"),
        .testTarget(
            name: "Soom3DLoaderTests",
            dependencies: ["Soom3DLoader"],
            path: "ios/Tests/Soom3DLoaderTests"
        ),
    ]
)
