/*
  The Bezier Remover removes Cubic Bezier curves from SVG paths and replaces whem with points along the curves.
 */
UTIL.BezierRemover = function(pointsPerCurve) {
    this.pointsPerCurve = pointsPerCurve;
}

UTIL.BezierRemover.prototype.handleCurve = function(p1, p2, p3, p4) {
    // TODO
}