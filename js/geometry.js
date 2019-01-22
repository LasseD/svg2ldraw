'use strict';

var UTIL = {};

/*
  Geometric utility types and functions.
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

UTIL.Line.prototype.crosses = function(a) {
    if(a.p1.equals(this.p1) ||
       a.p1.equals(this.p2) ||
       a.p2.equals(this.p1) ||
       a.p2.equals(this.p2))
        return false;
    if(this.leftTurn(a.p1) == this.leftTurn(a.p2))
        return false;

    const x1 = this.p1.x, y1 = this.p1.y, x2 = this.p2.x, y2 = this.p2.y;
    const x3 = a.p1.x, y3 = a.p1.y, x4 = a.p2.x, y4 = a.p2.y;
    const t = ((y3-y4)*(x1-x3)+(x4-x3)*(y1-y3)) / ((x4-x3)*(y1-y2)-(x1-x2)*(y4-y3));
    return t >= 0 && t <= 1; // Intersetion on line segment.
}

// Stolen from: http://www.cs.swan.ac.uk/~cssimon/line_intersection.html
UTIL.Line.prototype.getIntersection = function(a) {
    const x1 = this.p1.x, y1 = this.p1.y, x2 = this.p2.x, y2 = this.p2.y;
    const x3 = a.p1.x, y3 = a.p1.y, x4 = a.p2.x, y4 = a.p2.y;
    const t = ((y3-y4)*(x1-x3)+(x4-x3)*(y1-y3)) / ((x4-x3)*(y1-y2)-(x1-x2)*(y4-y3));
    const x = this.p1.x + t*(this.p2.x-this.p1.x);
    const y = this.p1.y + t*(this.p2.y-this.p1.y);
    return new UTIL.Point(x, y);
}

