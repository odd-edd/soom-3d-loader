// Pure frame math. Mirrors SPEC.md section by section; keep it in sync with
// packages/web/src/core.ts and android/.../Core.kt.
import Foundation

public enum Variant: String, CaseIterable, Sendable {
    case orbit, wave, morph, breathe, surf, helix, twist
    case chase, comet, bounce, pulse, beat, cube, trio, atom

    /// Per-variant extent, tilt and spin from the presets.
    var shape: (extent: Double, tilt: Double, spin: Double) {
        switch self {
        case .orbit: return (Presets.Orbit.extent, Presets.Orbit.tilt, Presets.Orbit.spin)
        case .wave: return (Presets.Wave.extent, Presets.Wave.tilt, Presets.Wave.spin)
        case .morph: return (Presets.Morph.extent, Presets.Morph.tilt, Presets.Morph.spin)
        case .breathe: return (Presets.Breathe.extent, Presets.Breathe.tilt, Presets.Breathe.spin)
        case .surf: return (Presets.Surf.extent, Presets.Surf.tilt, Presets.Surf.spin)
        case .helix: return (Presets.Helix.extent, Presets.Helix.tilt, Presets.Helix.spin)
        case .twist: return (Presets.Twist.extent, Presets.Twist.tilt, Presets.Twist.spin)
        case .chase: return (Presets.Chase.extent, Presets.Chase.tilt, Presets.Chase.spin)
        case .comet: return (Presets.Comet.extent, Presets.Comet.tilt, Presets.Comet.spin)
        case .bounce: return (Presets.Bounce.extent, Presets.Bounce.tilt, Presets.Bounce.spin)
        case .pulse: return (Presets.Pulse.extent, Presets.Pulse.tilt, Presets.Pulse.spin)
        case .beat: return (Presets.Beat.extent, Presets.Beat.tilt, Presets.Beat.spin)
        case .cube: return (Presets.Cube.extent, Presets.Cube.tilt, Presets.Cube.spin)
        case .trio: return (Presets.Trio.extent, Presets.Trio.tilt, Presets.Trio.spin)
        case .atom: return (Presets.Atom.extent, Presets.Atom.tilt, Presets.Atom.spin)
        }
    }
}

/// `fade` (0–1, almost always 1) thins out trails: renderers multiply alpha by it and shrink the dot.
public struct Dot: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var depth: Double
    public var fade: Double
}

private typealias Vec = (Double, Double, Double)

private let goldenAngle = Double.pi * (3 - 5.0.squareRoot())
private let tau = 2 * Double.pi

private func smooth(_ a: Double) -> Double { a * a * (3 - 2 * a) }

public func hash01(_ i: Int) -> Double {
    var x = UInt32(truncatingIfNeeded: i + 1) &* 2_654_435_761
    x ^= x >> 16
    x = x &* 0x45d9f3b
    x ^= x >> 16
    return Double(x) / 4_294_967_296
}

/// Point `i` of `n` on a Fibonacci sphere (unit radius).
private func fib(_ i: Int, _ n: Int) -> Vec {
    let y = 1 - 2 * (Double(i) + 0.5) / Double(n)
    let r = (1 - y * y).squareRoot()
    let th = goldenAngle * Double(i)
    return (cos(th) * r, y, sin(th) * r)
}

private func rotX(_ p: Vec, _ b: Double) -> Vec {
    (p.0, p.1 * cos(b) - p.2 * sin(b), p.1 * sin(b) + p.2 * cos(b))
}

private func rotY(_ p: Vec, _ g: Double) -> Vec {
    (p.0 * cos(g) + p.2 * sin(g), p.1, -p.0 * sin(g) + p.2 * cos(g))
}

private func rotZ(_ p: Vec, _ g: Double) -> Vec {
    (p.0 * cos(g) - p.1 * sin(g), p.0 * sin(g) + p.1 * cos(g), p.2)
}

private func scaled(_ p: Vec, _ s: Double) -> Vec { (p.0 * s, p.1 * s, p.2 * s) }

/// Largest n ≥ 2 with n³ ≤ count (integer-only so every platform agrees).
private func cubeSide(_ count: Int) -> Int {
    var n = 2
    while (n + 1) * (n + 1) * (n + 1) <= count { n += 1 }
    return n
}

/// Grid divisions per cube edge for morph: largest n ≥ 1 with 6n² + 2 ≤ count.
private func morphSide(_ count: Int) -> Int {
    var n = 1
    while 6 * (n + 1) * (n + 1) + 2 <= count { n += 1 }
    return n
}

/// How many dots a variant draws for a requested count (grid variants round down).
public func dotCount(variant: Variant, requested: Int) -> Int {
    switch variant {
    case .morph:
        let n = morphSide(requested)
        return 6 * n * n + 2
    case .cube:
        let n = cubeSide(requested)
        return n * n * n
    default:
        return requested
    }
}

/// Position of dot `i` (of `count`) before the shared rotation.
private func place(_ variant: Variant, _ i: Int, _ count: Int, _ t: Double) -> Vec {
    let u = Double(i) / Double(count)
    let s0 = fib(i, count)
    let r = (1 - s0.1 * s0.1).squareRoot()
    let th = goldenAngle * Double(i)
    func crest(_ angle: Double, rate: Double, sharpness: Double) -> Double {
        pow((1 + cos(angle - rate * t)) / 2, sharpness)
    }

    switch variant {
    case .orbit:
        return s0
    case .wave:
        let p = Presets.Wave.self
        return scaled(s0, 1 + p.amplitude * sin(s0.1 * p.frequency + 3 * t) * cos(0.5 * th + t))
    case .morph:
        // Lattice points on the cube's surface, edges and corners included (each once), in
        // a fixed scan order; blends between the normalised (sphere) and flat (cube) point.
        let n = morphSide(count)
        var q: Vec = (0, 0, 0)
        var seen = -1
        scan: for a in 0...n {
            for b in 0...n {
                for c in 0...n where a % n == 0 || b % n == 0 || c % n == 0 {
                    seen += 1
                    if seen == i {
                        q = (-1 + 2 * Double(a) / Double(n), -1 + 2 * Double(b) / Double(n), -1 + 2 * Double(c) / Double(n))
                        break scan
                    }
                }
            }
        }
        let len = (q.0 * q.0 + q.1 * q.1 + q.2 * q.2).squareRoot()
        let m = smooth((sin(Presets.Morph.rate * t) + 1) / 2)
        return scaled(q, 1 / len + (Presets.Morph.cubeSize - 1 / len) * m)
    case .breathe:
        let p = Presets.Breathe.self
        let e = smooth(max(0, sin(p.rate * t)))
        return scaled(s0, 1 + e * p.spread * (0.5 + hash01(i)))
    case .surf:
        // Crest sweeps left to right around the sphere; swells most at the equator, a little at the poles.
        let p = Presets.Surf.self
        let c = crest(-th, rate: p.rate, sharpness: p.sharpness)
        return scaled(s0, 1 + p.amplitude * c * (p.poleSwell + (1 - p.poleSwell) * pow(r, p.equatorBias)))
    case .helix:
        let p = Presets.Helix.self
        let half = Double((count + 1) / 2)
        let w = Double(i / 2) / half
        let a = tau * p.turns * w + Double(i % 2) * Double.pi
        let rad = p.radius * (1 + p.pulse * sin(2 * tau * w - p.rate * t))
        return (cos(a) * rad, 0.9 * (2 * w - 1), sin(a) * rad)
    case .twist:
        let p = Presets.Twist.self
        let a = p.amount * sin(p.rate * t) * s0.1
        return (s0.0 * cos(a) - s0.2 * sin(a), s0.1, s0.0 * sin(a) + s0.2 * cos(a))
    case .chase:
        // Beads (little dotted balls) round a ring, like a classic spinner. A crest runs round:
        // the bead under it comes forward and grows, the rest sit back, small and faint.
        let p = Presets.Chase.self
        let beads = Int(p.beads.rounded())
        let bead = i % beads
        let per = (count + beads - 1) / beads
        let a = tau * Double(bead) / Double(beads)
        let c = crest(a, rate: p.rate, sharpness: p.sharpness)
        let q = fib(i / beads, per)
        let br = p.beadRadius * (0.55 + 0.6 * c)
        return (cos(a) * p.radius + q.0 * br, sin(a) * p.radius + q.1 * br, p.lift * (2 * c - 1) + q.2 * br)
    case .comet:
        // A comet on a tilted orbit: thick head, thinning tail; more dots near the head.
        let p = Presets.Comet.self
        let s = pow(u, 1.6)
        let a = p.rate * t - tau * p.length * s
        let rho = p.headRadius * pow(1 - s, 1.2) + 0.01
        let ring = p.radius + cos(th) * rho
        return (ring * cos(a), sin(th) * rho, ring * sin(a))
    case .bounce:
        // Three dotted balls hopping one after another, each slowly turning.
        let p = Presets.Bounce.self
        let ball = i % 3
        let per = (count + 2) / 3
        let q = rotY(fib(i / 3, per), p.rate * t)
        let hop = p.height * max(0, sin(p.rate * t - Double(ball) * p.delay))
        return (q.0 * p.ballRadius + Double(ball - 1) * p.gap, q.1 * p.ballRadius - hop, q.2 * p.ballRadius)
    case .pulse:
        // Rings of dots spreading from the centre and sinking back as they widen.
        let p = Presets.Pulse.self
        let rings = Int(p.rings.rounded())
        let k = i % rings
        let per = (count + rings - 1) / rings
        let phase = p.rate * t + Double(k) / Double(rings)
        let f = phase - floor(phase)
        let rr = 0.12 + 0.88 * f
        let a = tau * Double(i / rings) / Double(per)
        return (cos(a) * rr, p.sink * f * f, sin(a) * rr)
    case .beat:
        // A row of bars on a gentle arc, each a 2x2 column of dots, rising and falling like an
        // equaliser; bars grow up and down from the middle.
        let p = Presets.Beat.self
        let bars = Int(p.bars.rounded())
        let b = i % bars
        let k = i / bars
        let per = Int((Double(count) / Double(bars) / 4).rounded(.up))
        let s = (Double(k / 4) + 0.5) / Double(per) - 0.5
        let level = pow(0.5 + 0.5 * sin(p.rate * t - Double(b) * p.phase), 2)
        let h = p.minHeight + (p.maxHeight - p.minHeight) * level
        let x = (Double(b) - Double(bars - 1) / 2) * p.gap
        let ox = (k % 2 == 0 ? -1.0 : 1.0) * p.thickness
        let oz = ((k / 2) % 2 == 0 ? -1.0 : 1.0) * p.thickness
        return (x + ox, s * h, -p.arc * x * x + oz)
    case .cube:
        // A grid cube whose layers turn a quarter turn one after another, like a puzzle cube.
        let p = Presets.Cube.self
        let n = cubeSide(count)
        func g(_ k: Int) -> Double { p.size * (-1 + 2 * (Double(k) + 0.5) / Double(n)) }
        let q: Vec = (g(i / (n * n)), g((i / n) % n), g(i % n))
        let stepD = floor(p.rate * t)
        let step = Int(stepD)
        let turn = smooth(p.rate * t - stepD) * (Double.pi / 2)
        let axis = step % 3
        let layer = g((step / 3) % n)
        let coord = axis == 0 ? q.0 : axis == 1 ? q.1 : q.2
        if abs(coord - layer) > 1e-9 { return q }
        let c = cos(turn), sn = sin(turn)
        if axis == 0 { return (q.0, q.1 * c - q.2 * sn, q.1 * sn + q.2 * c) }
        if axis == 1 { return (q.0 * c + q.2 * sn, q.1, -q.0 * sn + q.2 * c) }
        return (q.0 * c - q.1 * sn, q.0 * sn + q.1 * c, q.2)
    case .trio:
        // Three dotted balls chasing each other round a tilted circle.
        let p = Presets.Trio.self
        let ball = i % 3
        let per = (count + 2) / 3
        let q = fib(i / 3, per)
        let a = p.rate * t + Double(ball) * tau / 3
        let rr = p.ballRadius * (1 + p.pulse * sin(p.rate * 2 * t + Double(ball) * 2))
        return (q.0 * rr + cos(a) * p.radius, q.1 * rr, q.2 * rr + sin(a) * p.radius)
    case .atom:
        // A nucleus of jiggling nucleons and three electrons (dense little balls) flying round
        // it on crossed orbits, each leaving a trail along its orbit.
        let p = Presets.Atom.self
        let nucleusN = Int(Double(count) * p.nucleusShare)
        if i < nucleusN {
            let nucleon = i % 8
            let per = (nucleusN + 7) / 8
            let jiggle = 1 + 0.08 * sin(p.rate * 3 * t + Double(nucleon) * 1.7)
            let c = fib(nucleon, 8)
            let q = fib(i / 8, per)
            return (
                c.0 * p.nucleusRadius * jiggle + q.0 * p.nucleonRadius,
                c.1 * p.nucleusRadius * jiggle + q.1 * p.nucleonRadius,
                c.2 * p.nucleusRadius * jiggle + q.2 * p.nucleonRadius
            )
        }
        // Each electron's dots are split between its ball and a trail along its orbit behind it,
        // packed tight near the electron and thinning out further back.
        let j = i - nucleusN
        let e = j % 3
        let k = j / 3
        let perElectron = (count - nucleusN + 2) / 3
        let ballN = max(1, Int((Double(perElectron) * p.electronShare).rounded()))
        let head = p.rate * t * (1 + 0.15 * Double(e)) + Double(e) * tau / 3
        func orbitPoint(_ a: Double) -> Vec {
            rotZ(rotX((cos(a) * p.orbitRadius, 0, sin(a) * p.orbitRadius), p.orbitTilt), Double(e) * Double.pi / 3)
        }
        if k >= ballN {
            let q = Double(k - ballN + 1) / Double(max(1, perElectron - ballN))
            return orbitPoint(head - tau * p.trailLength * pow(q, 1.7))
        }
        let c = orbitPoint(head)
        let q = fib(k, ballN)
        return (c.0 + q.0 * p.electronRadius, c.1 + q.1 * p.electronRadius, c.2 + q.2 * p.electronRadius)
    }
}

/// How strongly dot `i` is drawn, 0–1 (1 for almost every dot). Trails use it to thin out.
private func fade(_ variant: Variant, _ i: Int, _ count: Int) -> Double {
    guard variant == .atom else { return 1 }
    let p = Presets.Atom.self
    let nucleusN = Int(Double(count) * p.nucleusShare)
    if i < nucleusN { return 1 }
    let k = (i - nucleusN) / 3
    let perElectron = (count - nucleusN + 2) / 3
    let ballN = max(1, Int((Double(perElectron) * p.electronShare).rounded()))
    if k < ballN { return 1 }
    return 1 - p.trailFade * Double(k - ballN + 1) / Double(max(1, perElectron - ballN))
}

/// Dots sorted back to front. `t` is elapsed seconds already multiplied by speed.
/// Draws `dotCount(variant:requested:)` dots.
public func computeFrame(variant: Variant, count requested: Int, t: Double) -> [Dot] {
    let d = Presets.Defaults.self
    let count = dotCount(variant: variant, requested: requested)
    let (extent, tilt, spin) = variant.shape
    let ca = cos(spin * t), sa = sin(spin * t)
    let cb = cos(tilt), sb = sin(tilt)

    var dots = [Dot]()
    dots.reserveCapacity(count)
    for i in 0..<count {
        let (px, py, pz) = place(variant, i, count, t)
        let x = px * ca + pz * sa
        let z = -px * sa + pz * ca
        let y = py * cb - z * sb
        let z2 = py * sb + z * cb
        let k = 1 / (1 - z2 * d.perspective)
        dots.append(Dot(x: x * k / extent, y: y * k / extent, depth: min(1, max(0, (z2 / extent + 1) / 2)), fade: fade(variant, i, count)))
    }

    return dots.enumerated()
        .sorted { $0.element.depth != $1.element.depth ? $0.element.depth < $1.element.depth : $0.offset < $1.offset }
        .map(\.element)
}
