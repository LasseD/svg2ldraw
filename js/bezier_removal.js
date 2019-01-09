/*
  The Bezier Remover removes Cubic Bezier curves from SVG paths and replaces whem with points along the curves.
 */
UTIL.BezierRemover = function(pointsPerPixel) {
    this.pointsPerPixel = pointsPerPixel;
}

UTIL.BezierRemover.prototype.handleCurve = function(p0, p1, p2, p3) {
    var dx = p0.x-p3.x, dy = p0.y-p3.y;
    var curveLength = Math.sqrt(dx*dx + dy*dy);
    var pointsPerCurve = curveLength*this.pointsPerPixel;
    console.log("Drawing " + pointsPerCurve + " points on curve of length " + curveLength);
    var ret = [];
    for(var i = 0; i < pointsPerCurve; i++) {
        var t = (i+1)/pointsPerCurve, t2 = t*t, t3 = t2*t;
        var nt = 1-t, nt2 = nt*nt, nt3 = nt2*nt;
        var x = nt3*p0.x + 3*nt2*t*p1.x + 3*nt*t2*p2.x + t3*p3.x;
        var y = nt3*p0.y + 3*nt2*t*p1.y + 3*nt*t2*p2.y + t3*p3.y;
        ret.push({x,y});
    }
    return ret;
}