'use strict';

var UTIL = {};
UTIL.Precision = 4; // Used for outputting to LDraw
UTIL.EPSILON = 1e-5; // Used for epsilon-comparisons for equality.

UTIL.isZero = function(x) {
    return x >= -UTIL.EPSILON && x <= UTIL.EPSILON;;
}

/*
  Geometric types and utility functions.

  Types:
  - Point (x,y)
  - Line (p1, p2) can represent both a line segment and a line.
  - CH (Convex hull)
 */
UTIL.Point = function(x, y) {
    this.x = x;
    this.y = y;
}

UTIL.Point.prototype.toSvg = function(color) {
    return '--><circle ' + (color?'fill="'+color+'"':'') +' r="1" cx="' + this.x + '" cy="' + this.y + '"/><!--';
}

UTIL.Point.prototype.equals = function(other) {
    return UTIL.isZero(this.x - other.x) && UTIL.isZero(this.y - other.y);
}

UTIL.Point.prototype.sub = function(p) {
    return new UTIL.Point(this.x-p.x, this.y-p.y);
}

UTIL.Point.prototype.add = function(p) {
    return new UTIL.Point(this.x+p.x, this.y+p.y);
}

UTIL.Line = function(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
}

UTIL.Line.prototype.toSvg = function() {
    return '--><line stroke="black" x1="' + this.p1.x + '" y1="' + this.p1.y + '" x2="' + this.p2.x + '" y2="' + this.p2.y + '"/><!--';
}

UTIL.Line.prototype.eval = function(x) {
    if(x == this.p1.x)
        return this.p1.y;
    if(x == this.p2.x)
        return this.p2.y;
    return this.p1.y + (x-this.p1.x) * (this.p2.y-this.p1.y) / (this.p2.x-this.p1.x);
}

UTIL.getTurn = function(a, b, c) {
    return (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
}
UTIL.leftTurn = function(a, b, c) {
    return UTIL.getTurn(a, b, c) > UTIL.EPSILON;
}
UTIL.rightTurn = function(a, b, c) {
    return UTIL.getTurn(a, b, c) < -UTIL.EPSILON;
}

UTIL.Line.prototype.leftTurn = function(a) {
    return UTIL.leftTurn(this.p1, this.p2, a);
}

UTIL.Line.prototype.isParallelWith = function(p1, p2) {
    var p0 = p2.sub(p1.sub(this.p1));
    return UTIL.isZero(UTIL.getTurn(this.p1, this.p2, p0));
}

UTIL.Line.prototype.intersectsPoint = function(p) {
    var turn = UTIL.getTurn(this.p1, this.p2, p);
    //console.warn(this.toSvg() + " vs " + p.toSvg() + " => " + turn);
    return UTIL.isZero(turn);
}

UTIL.Line.prototype.crossesLine = function(p1, p2) {
    if(p1.equals(p2)) {
        throw "Degenerate line: " + new UTIL.Line(p1,p2).toSvg();
    }
    if(this.isParallelWith(p1, p2)) {
        //console.log("Parallel lines: " + this.toSvg() + " vs " + new UTIL.Line(p1,p2).toSvg())
        return false; // Parallel lines never intersect
    }
    if(p1.equals(this.p1) ||
       p1.equals(this.p2) ||
       p2.equals(this.p1) ||
       p2.equals(this.p2))
        return false;
    return this.leftTurn(p1) != this.leftTurn(p2);
}

UTIL.Line.prototype.crossesLineSegment = function(p1, p2) {
    if(!this.crossesLine(p1, p2)) {
        return false;
    }

    const x1 = this.p1.x, y1 = this.p1.y, x2 = this.p2.x, y2 = this.p2.y;
    const x3 = p1.x, y3 = p1.y, x4 = p2.x, y4 = p2.y;
    const t = ((y3-y4)*(x1-x3)+(x4-x3)*(y1-y3)) / ((x4-x3)*(y1-y2)-(x1-x2)*(y4-y3));
    return t >= 0 && t <= 1; // Intersetion on line segment.
}

// Stolen from: http://www.cs.swan.ac.uk/~cssimon/line_intersection.html
UTIL.Line.prototype.getIntersectionWithLine = function(p1, p2) {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = this.p1.x, y3 = this.p1.y, x4 = this.p2.x, y4 = this.p2.y;
    const t = ((y3-y4)*(x1-x3)+(x4-x3)*(y1-y3)) / ((x4-x3)*(y1-y2)-(x1-x2)*(y4-y3));
    const x = x1 + t*(x2-x1);
    const y = y1 + t*(y2-y1);
    return new UTIL.Point(x, y);
}

UTIL.COLORS = ['#FBB', '#FBF', '#F00', '#0F0', '#00F', '#FF0', '#0FF', '#F0F', '#000', '#BFF'];
UTIL.IDX = 0;

UTIL.CH = function(pts, color) {
    this.pts = pts;
    this.color = color;
    //this.color = UTIL.COLORS[(UTIL.IDX++)%UTIL.COLORS.length];

    // Verify that pts form a convext hull without duplicates:
    if(pts.length < 3) {
        throw "Degenerate convex hull with only " + pts.length + " vertices!";
    }
    var prevprev = pts[pts.length-2], prev = pts[pts.length-1];
    for(var i = 0; i < pts.length; i++) {
        var p = pts[i];

        if(!UTIL.rightTurn(prevprev, prev, p)) {
            console.log(this.toSvg());
            console.dir(prevprev);
            console.dir(prev);
            console.dir(p);
            throw "Concave or inline points on convex hull!";
        }
        
        prevprev = prev;
        prev = p;
    }
}

UTIL.CH.prototype.getAPointInside = function() {
    // Simply return the centroid:
    var x = this.pts.map(p => p.x).reduce((sum, x) => x+sum)/this.pts.length;
    var y = this.pts.map(p => p.y).reduce((sum, y) => y+sum)/this.pts.length;
    if(!this.isInside(new UTIL.Point(x, y))) {
        console.dir(this);
        throw "Invalid point inside triangle: " + x + ', ' + y;;
    }
    return new UTIL.Point(x, y);
}

UTIL.CH.prototype.toLDraw = function() {
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

    var pts = this.pts;
    var ret = "";
    do {
        var len = Math.min(4, pts.length);
        ret += len + " " + this.color;
        for(var i = 0; i < len; i++) {
            var p = pts[i];
            ret += " " + convert(p.x) + " 0 " + convert(p.y);
        }
        ret += "\n";
        pts = pts.splice(0, len);
    }
    while(pts.length > 0);

    return ret;
}

UTIL.CH.prototype.toSvg = function() {
    var ret = '--><path fill="' + this.color + '" d="M';

    this.pts.forEach(p => ret += " " + p.x + "," + p.y);
    ret += 'Z"/><!--';
    return ret;
}

UTIL.CH.prototype.isInside = function(pointInside) {
    var prev = this.pts[this.pts.length-1];
    for(var i = 0; i < this.pts.length; i++) {
        var p = this.pts[i];
        if(!UTIL.rightTurn(prev, p, pointInside))
            return false;
        prev = p;
    }
    return true;
}

UTIL.CH.prototype.intersectsLineSegment = function(line) {
    var prev = this.pts[this.pts.length-1];
    for(var i = 0; i < this.pts.length; i++) {
        var p = this.pts[i];
        if(line.crossesLineSegment(p, prev)) {
            //console.log("CH - line intersection. Line: " + this.toSvg() + ", intersection: " + this.getIntersectionWithLineSegment(prev, p).toSvg());
            //console.log(prev.toSvg());
            //console.log(p.toSvg());
            //console.log(this.toSvg());
            return true;
        }
        prev = p;
    }
    return this.isInside(line.p1) || this.isInside(line.p2);
}

/*
  Assert the line already splits the CH.
 */
UTIL.CH.prototype.splitByLine = function(line, ret) {
    const pointIntersectionIndices = this.pts.map((p,idx) => line.intersectsPoint(p) ? idx : -1).filter(x => x >= 0);
    if(pointIntersectionIndices.length > 2) {
        console.log(line.toSvg());
        console.log(this.toSvg());
        pointIntersectionIndices.forEach(idx => console.log(this.pts[idx].toSvg()));
        throw "Line intersects more than 2 vertices of CH: " + pointIntersectionIndices;
    }

    if(pointIntersectionIndices.length == 2) { // Split in two or not at all
        if(pointIntersectionIndices[1]-pointIntersectionIndices[0] == 1 ||
           pointIntersectionIndices[1]-pointIntersectionIndices[0] == this.pts.length-1) {
            ret.push(this);
            return; // Adjacent corners are intersected - do not split.
        }
        // Output two new CH's split through the two lines:
        var idx = pointIntersectionIndices[0];
        var pts = [ this.pts[idx] ];
        do {
            idx++;
            pts.push(this.pts[idx]);
        }
        while(idx != pointIntersectionIndices[1]);
        ret.push(new CH(pts, this.color));

        idx = pointIntersectionIndices[1];
        pts = [ this.pts[idx] ];
        do {
            idx++;
            if(idx == this.pts.length)
                idx = 0;
            pts.push(this.pts[idx]);
        }
        while(idx != pointIntersectionIndices[0]);
        ret.push(new CH(pts, this.color));

        return;
    }

    const lineIntersectionIndices = this.pts.map((p,idx,a) => line.crossesLine(p, a[(idx+1)%a.length]) ? idx : -1).filter(x => x >= 0);
    if(lineIntersectionIndices.length > 2 || lineIntersectionIndices.length == 0) {
        throw "Expected 1-2 CH/line intersections. Found " + lineIntersectionIndices.length;
    }

    if(pointIntersectionIndices.length == 1) { // Split in two with a single line split:
        if(lineIntersectionIndices.length != 1) {
            console.log(this.toSvg());
            console.log(line.toSvg());
            lineIntersectionIndices.forEach(idx => console.log(line.getIntersectionWithLine(
                                  this.pts[idx], this.pts[(idx+1)%this.pts.length]).toSvg('blue')));
            pointIntersectionIndices.forEach(idx => console.log(this.pts[idx].toSvg('pink')));
            throw "Expected 1 quad/line intersection. Found " + lineIntersectionIndices.length;
        }

        const v0 = pointIntersectionIndices[0];
        const v1 = lineIntersectionIndices[1];
        if(v0 == v1 || v0 == (v1+1)%this.pts.length) {
            throw "Unexpected quad/line intersection in adjacent line/vertex!";
        }
        
        const va = line.getIntersectionWithLine(this.pts[v1], this.pts[(v1+1)%this.pts.length]);
        // Split in v0-...-va and v0-va-...
        var pts = [ this.pts[v0] ];
        var idx = v0;
        do {
            idx++;
            if(idx == this.pts.length)
                idx = 0;
            pts.push(this.pts[idx]);
        }
        while(idx != v1);
        pts.push(va);
        ret.push(new CH(pts, this.color));

        pts = [ this.pts[v0], va ];
        idx = v1;
        do {
            idx++;
            if(idx == this.pts.length)
                idx = 0;
            pts.push(this.pts[idx]);
        }
        while(idx != v0);
        ret.push(new CH(pts, this.color));

        return;
    }

    // Two line splits:
    if(lineIntersectionIndices.length != 2) {
        console.log(this.toSvg());
        console.log(line.toSvg());
        lineIntersectionIndices.forEach(idx => console.log(line.getIntersectionWithLine(
                               this.pts[idx], this.pts[(idx+1)%this.pts.length]).toSvg('blue')));
        throw "Expected 2 line intersections when 0 point intersections. Found: " + lineIntersectionIndices;
    }
    const i0 = lineIntersectionIndices[0];
    const x0 = line.getIntersectionWithLine(this.pts[i0], this.pts[(i0+1)%this.pts.length]);
    const i1 = lineIntersectionIndices[1];
    const x1 = line.getIntersectionWithLine(this.pts[i1], this.pts[(i1+1)%this.pts.length]);

    var pts = [ x0, x1 ];
    var idx = i1;
    do {
        idx++;
        if(idx == this.pts.length)
            idx = 0;
        pts.push(this.pts[idx]);
    }
    while(idx != i0);
    ret.push(new UTIL.CH(pts, this.color));

    pts = [ x1, x0 ];
    var idx = i0;
    do {
        idx++;
        if(idx == this.pts.length)
            idx = 0;
        pts.push(this.pts[idx]);
    }
    while(idx != i1);
    ret.push(new UTIL.CH(pts, this.color));
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
                if(x.intersectsLineSegment(line)) {
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
            var a = as[i];
            if(a.isInside(pointInside)) {
                //console.log("Skip: " + b.toSvg() + " inside of " + a.toSvg());
                return false;
            }
        }
        return true;
    });
}