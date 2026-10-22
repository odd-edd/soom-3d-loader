import Foundation
import Testing
@testable import Soom3DLoader

/// Checks the Swift core against spec/golden.json, produced by the web core.
struct GoldenTests {
    struct Golden: Decodable {
        struct Case: Decodable {
            let variant: String
            let count: Int
            let t: Double
            let frame: [Double]
        }
        let tolerance: Double
        let cases: [Case]
    }

    @Test func matchesGoldenFrames() throws {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("spec/golden.json")
        let golden = try JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
        #expect(!golden.cases.isEmpty)

        for c in golden.cases {
            let variant = try #require(Variant(rawValue: c.variant))
            let flat = computeFrame(variant: variant, count: c.count, t: c.t).flatMap { [$0.x, $0.y, $0.depth, $0.fade] }
            #expect(flat.count == c.frame.count)
            let worst = zip(flat, c.frame).map { abs($0 - $1) }.max() ?? 0
            #expect(worst <= golden.tolerance, "\(c.variant) t=\(c.t) max diff \(worst)")
        }
    }
}
