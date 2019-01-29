/*
  The Bezier Remover removes Cubic Bezier curves from SVG paths and replaces whem with points along the curves.
 */
UTIL.BezierRemover = function(pointsPerPixel) {
    this.pointsPerPixel = pointsPerPixel;
}

UTIL.MaxPointsPerCurve = 48;

UTIL.BezierRemover.prototype.handleCurve = function(x0, y0, x1, y1, x2, y2, x3, y3) {
    var dx = x0-x3, dy = y0-y3;
    var curveLength = Math.sqrt(dx*dx + dy*dy);
    var pointsPerCurve = Math.min(UTIL.MaxPointsPerCurve, Math.ceil(curveLength*this.pointsPerPixel));
    //console.log("Drawing " + pointsPerCurve + " points on curve of length " + curveLength);
    var ret = [];
    for(var i = 0; i < pointsPerCurve; i++) {
        var t = (i+1)/pointsPerCurve, t2 = t*t, t3 = t2*t;
        var nt = 1-t, nt2 = nt*nt, nt3 = nt2*nt;
        var x = nt3*x0 + 3*nt2*t*x1 + 3*nt*t2*x2 + t3*x3;
        var y = nt3*y0 + 3*nt2*t*y1 + 3*nt*t2*y2 + t3*y3;
        ret.push({x,y});
    }
    return ret;
}