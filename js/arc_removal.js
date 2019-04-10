/*
  The Arc Remover removes arcs from SVG paths and replaces whem with points along the arcs.
 */
UTIL.ArcRemover = function(pointsPerPixel) {
    this.pointsPerPixel = pointsPerPixel;
}

/*
  See: https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
  x1,y1 = first point
  rx, ry = ellipse radii
  φ = xAxisRotation
  fA = largeArcFlag
  fS = sweepFlag
  x2,y2 = end point
*/
UTIL.ArcRemover.prototype.handle = function(x1, y1, rx, ry, xAxisRotation, largeArcFlag, sweepFlag,
                                            x2, y2) {
    if(UTIL.isZero(rx) || UTIL.isZero(ry)) {
        return [{x:x2, y:y2}]; // Section B.2.5 Step 1
    }
    // Section B.2.5 Step 2:
    if(rx < 0) {
        rx = -rx; // eq. 6.1 (It should read rx <- |rx| in the documentation)
    }
    if(ry < 0) {
        ry = -ry; // eq. 6.1
    }

    // First find the parameters for center parametization. See section B.2.4

    // Step 1: Compute (x1′, y1′) = (x1P, y1P)
    var cosA = Math.cos(xAxisRotation), sinA = Math.sin(xAxisRotation);
    var xHalfDist = 0.5*(x1 - x2), yHalfDist = 0.5*(y1 - y2); // (x1-x2)2 and (y1-y2)/2 from eq. 5.1
    var x1P = cosA*xHalfDist + sinA*yHalfDist, y1P = -sinA*xHalfDist + cosA*yHalfDist; // eq. 5.1

    // Step 2: Compute (cx′, cy′) = (cxP, cyP)
    var signMult = largeArcFlag === sweepFlag ? -1 : 1; // Comment of eq. 5.2
    var rxSq = rx*rx, rySq = ry*ry, y1PSq = y1P*y1P, x1PSq = x1P*x1P; // Squares in eq. 5.2

    {
        // Section B.2.5 Step 3: Ensure radii are large enough:
        var eq62 = x1PSq/rxSq + y1PSq/rySq; // eq. 6.1
        if(eq62 > 1) {
            var eq62Root = Math.sqrt(eq62); // Square root of eq. 6.2
            rx *= eq62Root; // eq. 6.3
            ry *= eq62Root; // eq. 6.3
            rxSq = rx*rx; // Recompute rx squared
            rySq = ry*ry; // Recompute ry squared
        }
    }

    var d = rxSq*y1PSq + rySq*x1PSq; // Demoninator in eq. 5.2
    var n = rxSq*rySq - rxSq*y1PSq - rySq*x1PSq; // Nominator in eq. 5.2
    var bigSquare = signMult * Math.sqrt(n/d); // +-Big square root in eq. 5.2
    var cxP = bigSquare * rx * y1P / ry, cyP = -bigSquare * ry*x1P/rx; // eq 5.2
    
    // Step 3: Compute (cx, cy) from (cx′, cy′)
    // Helper variables:
    var xMid = 0.5*(x2 + x1), yMid = 0.5*(y2 + y1); // (x1+x2)/2 and (y1+y2)/2 from eq. 5.3
    var cx = cosA*cxP - sinA*cyP + xMid, cy = sinA*cxP + cosA*cyP + yMid; // eq. 5.3

    // Step 4: Compute θ1 and Δθ = angle1 and angleDist in radians in the interval [-PI;PI]
    function angle(ux, uy, vx, vy) { // eq. 5.4
        var udotv = ux*vx+uy*vy; // u dot v from eq. 5.4
        function len(x,y) {
            return Math.sqrt(x*x+y*y);
        }
        var ret = Math.acos(udotv / (len(ux,uy) * len(vx,vy))); // eq. 5.4 without the sign and in the interval [0,PI]
        if(ux*vy - uy*vx < 0)
            return -ret; // Comment for eq. 5.4 regarding the sign.
        return ret;
    }

    var angle1 = angle(1, 0, (x1P-cxP)/rx, (y1P-cyP)/ry); // eq. 5.5
    var angleDist = angle((x1P-cxP)/rx, (y1P-cyP)/ry, (-x1P-cxP)/rx, (-y1P-cyP)/ry); // eq. 5.6, but without the %360. See below.
    // Note for eq. 5.6:
    if(!sweepFlag && angleDist > 0) {
        angleDist -= 2*Math.PI;
    }
    else if(sweepFlag && angleDist < 0) {
        angleDist += 2*Math.PI;    
    }

    // Section B.2.2: Using parameterization for outputting points on the arc:
    var curveLength = Math.PI*(rx+ry);
    var pointsPerCurve = Math.min(UTIL.MaxPointsPerCurve, Math.ceil(curveLength*this.pointsPerPixel));
    //console.log("Drawing " + pointsPerCurve + " points on arc of length " + curveLength + '. rx=' + rx+', ry='+ry);

    var ret = [];
    for(var i = 0; i < pointsPerCurve; i++) {
        var t = (i+1)/pointsPerCurve; // [0;1]
        var a = angle1 + angleDist * t;
        var rxcosa = rx*Math.cos(a), rysina = ry*Math.sin(a);
        var x = cosA*rxcosa - sinA*rysina + cx; // eq. 3.1
        var y = sinA*rxcosa + cosA*rysina + cy; // eq. 3.1
        ret.push({x:x, y:y});
        //console.log('Adding point ' + x + ', ' + y);
    }
    return ret;
}