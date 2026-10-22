#if canImport(SwiftUI)
import SwiftUI

/// `SoomView(variant: .orbit)` draws a rotating dot sphere.
/// Size it with `.frame(width:height:)`; dots are black unless `color` is given.
@available(iOS 15.0, macOS 12.0, *)
public struct SoomView: View {
    private static let reducedMotionT = 0.6

    var variant: Variant
    var color: Color
    var count: Int
    var speed: Double
    var label: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var start = Date()

    public init(
        variant: Variant = .orbit,
        color: Color = .black,
        count: Int = Presets.Defaults.count,
        speed: Double = Presets.Defaults.speed,
        label: String = "Loading"
    ) {
        self.variant = variant
        self.color = color
        self.count = count
        self.speed = speed
        self.label = label
    }

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion || scenePhase != .active)) { context in
            let t = reduceMotion ? Self.reducedMotionT : context.date.timeIntervalSince(start) * speed
            Canvas { ctx, size in
                draw(ctx, side: min(size.width, size.height), dots: computeFrame(variant: variant, count: count, t: t))
            }
        }
        .foregroundStyle(color)
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement()
        .accessibilityLabel(Text(label))
        .accessibilityAddTraits(.updatesFrequently)
    }

    private func draw(_ ctx: GraphicsContext, side: Double, dots: [Dot]) {
        let half = side / 2
        let base = side * 0.022 * Presets.Defaults.dotScale
        let minAlpha = Presets.Defaults.minAlpha
        for dot in dots {
            let radius = base * (0.45 + 0.75 * dot.depth) * (0.5 + 0.5 * dot.fade)
            let rect = CGRect(x: half + dot.x * half - radius, y: half + dot.y * half - radius, width: radius * 2, height: radius * 2)
            var layer = ctx
            layer.opacity = (minAlpha + (1 - minAlpha) * dot.depth) * dot.fade
            layer.fill(Path(ellipseIn: rect), with: .foreground)
        }
    }
}

#if canImport(UIKit)
import UIKit

/// UIKit wrapper for apps that are not on SwiftUI.
@available(iOS 15.0, *)
public final class SoomUIView: UIView {
    private let host: UIHostingController<SoomView>

    public init(variant: Variant = .orbit, color: UIColor? = nil) {
        host = UIHostingController(rootView: SoomView(variant: variant, color: color.map(Color.init) ?? .black))
        super.init(frame: .zero)
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            host.view.topAnchor.constraint(equalTo: topAnchor),
            host.view.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}
#endif
#endif
