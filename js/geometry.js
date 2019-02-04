'use strict';

var UTIL = {};
UTIL.Precision = 4; // Used for outputting to LDraw.

/*
  Geometric types and utility functions.

  Types:
  - Point (x,y)
  - Line (p1, p2) can represent both a line segment and a line.
  - Triangle and Quad (pts array of size 3 and 4)
 */
UTIL.Point = function(x, y) {
    this.x = x;
    this.y = y;
}

UTIL.Point.prototype.equals = function(other) {
    return this.x == other.x && this.y == other.y;
}

UTIL.Line = function(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
}

UTIL.Line.prototype.eval = function(x) {
    if(x == this.p1.x)
        return this.p1.y;
    if(x == this.p2.x)
        return this.p2.y;
    return this.p1.y + (x-this.p1.x) * (this.p2.y-this.p1.y) / (this.p2.x-this.p1.x);
}

UTIL.leftTurn = function(a, b, c) {
    return (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x) > 0;
}

UTIL.Line.prototype.leftTurn = function(a) {
    return UTIL.leftTurn(this.p1, this.p2, a);
}

UTIL.Line.prototype.crossesLine = function(p1, p2) {
    if(p1.equals(this.p1) ||
       p1.equals(this.p2) ||
       p2.equals(this.p1) ||
       p2.equals(this.p2))
        return false;
    return this.leftTurn(p1) != this.leftTurn(p2);
}

UTIL.Line.prototype.crossesLineSegment = function(p1, p2) {
    if(!this.crossesLine(p1, p2))
        return false;

    const x1 = this.p1.x, y1 = this.p1.y, x2 = this.p2.x, y2 = this.p2.y;
    const x3 = p1.x, y3 = p1.y, x4 = p2.x, y4 = p2.y;
    const t = ((y3-y4)*(x1-x3)+(x4-x3)*(y1-y3)) / ((x4-x3)*(y1-y2)-(x1-x2)*(y4-y3));
    return t >= 0 && t <= 1; // Intersetion on line segment.
}

// Stolen from: http://www.cs.swan.ac.uk/~cssimon/line_intersection.html
UTIL.Line.prototype.getIntersectionWithLineSegment = function(p1, p2) {
    const x1 = this.p1.x, y1 = this.p1.y, x2 = this.p2.x, y2 = this.p2.y;
    const x3 = p1.x, y3 = p1.y, x4 = p2.x, y4 = p2.y;
    const t = ((y3-y4)*(x1-x3)+(x4-x3)*(y1-y3)) / ((x4-x3)*(y1-y2)-(x1-x2)*(y4-y3));
    const x = this.p1.x + t*(this.p2.x-this.p1.x);
    const y = this.p1.y + t*(this.p2.y-this.p1.y);
    return new UTIL.Point(x, y);
}

UTIL.COLORS = ['#FBB', '#FBF', '#F00', '#0F0', '#00F', '#FF0', '#0FF', '#F0F', '#000', '#BFF'];
UTIL.IDX = 0;

UTIL.Triangle = function(pts, color) {
    this.pts = pts;
    this.color = color;
    //this.color = UTIL.COLORS[(UTIL.IDX++)%UTIL.COLORS.length];
}

UTIL.Quad = function(pts, color) {
    this.pts = pts;
    this.color = color;
    //this.color = UTIL.COLORS[(UTIL.IDX++)%UTIL.COLORS.length];
}

UTIL.Triangle.prototype.getAPointInside = function() {
    // Simply return the centroid:
    var x = (this.pts[0].x + this.pts[1].x + this.pts[2].x) / 3;
    var y = (this.pts[0].y + this.pts[1].y + this.pts[2].y) / 3;
    return new UTIL.Point(x, y);
}

UTIL.Quad.prototype.getAPointInside = function() {
    // Simply return the center of p0p2:
    var x = (this.pts[0].x + this.pts[2].x) / 2;
    var y = (this.pts[0].y + this.pts[2].y) / 2;
    return new UTIL.Point(x, y);
}

UTIL.toLDraw = function(geom) {
    const pts = geom.pts;
    var ret = pts.length + " " + color;

    function convert(x) {
        if(x == parseInt(x))
            return x;
        for(var i = 1; i < UTIL.Precision; i++) {
            var tmp = x.toFixed(i);
            if(tmp == x) {
                return tmp; // Don't output too many '0's.
            }
        }
        return x.toFixed(UTIL.Precision);
    }

    pts.forEach(p => ret += convert(p.x) + " 0 " + convert(p.y));
    return ret;
}

UTIL.Line.prototype.intersectsGeom = function(geom) {
    const pts = geom.pts;
    var prev = pts[pts.length-1];
    for(var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if(this.crossesLineSegment(p, prev))
            return true;
        prev = p;
    }
    return false;
}

/*
  Assert the line already splits the triangle.
 */
UTIL.Triangle.prototype.splitByLine = function(line, ret) {
    //console.log('Splitting trianggle');
    //console.dir(this);

    const leftTurns = this.pts.map(p => line.leftTurn(p));

    var vIdx; // The vertex index where both neighbours are intersected by line.
    if(leftTurns[0] == leftTurns[1])
        vIdx = 2;
    else if(leftTurns[2] == leftTurns[1])
        vIdx = 0;
    else
        vIdx = 1;

    /*
          p0
         /  \
 ----pb-/----\-pa----- line
       /      \
      p2------p1
     */
    const p0 = this.pts[vIdx], p1 = this.pts[(vIdx+1)%3], p2 = this.pts[(vIdx+2)%3];

    const pa = line.getIntersectionWithLineSegment(p0, p1);
    const pb = line.getIntersectionWithLineSegment(p2, p0);
    ret.push(new UTIL.Quad([p2, pb, pa, p1], this.color), new UTIL.Triangle([p0, pa, pb], this.color));
}

/*
  Assert the line already splits the triangle.
  TODO: This is a very naive implementation, which potentially causes too many artefacts. A smarter approach should be implemented.
 */
UTIL.Quad.prototype.splitByLine = function(line, ret) {
    const t1 = new UTIL.Triangle([ this.pts[0], this.pts[1], this.pts[2] ], this.color);
    const t2 = new UTIL.Triangle([ this.pts[0], this.pts[2], this.pts[3] ], this.color);
    if(line.intersectsGeom(t1)) {
        t1.splitByLine(line, ret);
        if(line.intersectsGeom(t2)) {
            t2.splitByLine(line, ret);
        }
        else
            ret.push(t2);
    }
    else { // line must intersect t2, but not t1:
        t2.splitByLine(line, ret);
        ret.push(t1);
    }
}

UTIL.insideGeom = function(geom, pointInside) {
    var prev = geom.pts[geom.pts.length-1];
    for(var i = 0; i < geom.pts.length; i++) {
        var p = geom.pts[i];
        if(UTIL.leftTurn(prev, p, pointInside))
            return false;
        prev = p;
    }
    return true;
}

/*
  Assume a and b are lists of triangles and quads. 
  The result from this function contains all parts of elements of b that do not overlap with any element from a.
  The parts are constructed by splitting the elements of b.

  This algorithm runs in 2 steps:
  1: Split all in b by the line segments of a.
  2: Filter the result from b and only take those not in a.

  TODO: 
  - Use an interval tree on the line seggments of a to improve performance in step 1.
  - Use search structure in a to improve performance of step 2.
 */
UTIL.cut = function(as, bs) {
    // Step 0: Get the line segments of a:
    var aSegs = [];
    as.forEach(function(a) {
        var pts = a.pts;
        var prev = pts[pts.length-1];
        for(var i = 0; i < pts.length; i++) {
            var p = pts[i];
            aSegs.push(new UTIL.Line(prev, p));
            prev = p;
        }
    });

    // Step 1: Split b by the line segments of a:
    var bParts = [];
    bs.forEach(function(b) {
        var bSet = [b];
        // Cut bSet up for all in aSegs:
        aSegs.forEach(function(line){
            var nextBSet = [];
            bSet.forEach(function(x) {
                if(line.intersectsGeom(x)) {
                    x.splitByLine(line, nextBSet);
                }
                else {
                    nextBSet.push(x);
                }
            });
            bSet = nextBSet;
        });
        bParts.push(...bSet);
    });

    // Step 2: Filter bParts by a:
    return bParts.filter(function(b) {
        var pointInside = b.getAPointInside();
        for(var i = 0; i < as.length; i++) {
            var geom = as[i];
            if(UTIL.insideGeom(geom, pointInside))
                return false;
        }
        //console.log("Including in result:");
        //console.dir(b);
        return true;
    });
}