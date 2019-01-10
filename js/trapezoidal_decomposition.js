"use strict";

/*
  The algorithm used to convert from SVG to LDraw is a sweep line algorithm.
  The sweep line algorithm moves a "sweep line" along the x-axis in the positive direction (left to right).
  The sweep line moves by handling events.
  Two kinds of events  exist: 'start' and 'end'. A line in a path causes a start event (left end point) and end event (right end point)

  When a start event e is encountered, the following is performed:
  - the line of the event is added to the sweep line.
  - If an existing line in the sweep line starts at the point of e, then no new trapezoid is construted.
  - Otherwise, a trapezoid t with the line below to the line above the one for e is constructed.
   - The left side of t is the right most of the starting points of the lines above and below.
   - The right side of t is the x-coordinate of e.
   - The starting points of the two lines is moved.
  When an end event e is encountered, the following is performed: 
  - The line of e is removed.
  - Trapezoids are created for the lines above and below the line of e

  The sweep line algorithm assumes lines are non-intersecting and points are non-overlapping.
  Vertical lines are ignored by the algorithm and points are ordered lexicographically.
 */
UTIL.TrapezoidalDecomposition = function(svgObj) {
    this.svgObj = svgObj;
    this.events = [];
    this.sweepLine = [];
    this.trapezoids = [];
}

/*
  Perform sweep line algorithm.
 */
UTIL.TrapezoidalDecomposition.prototype.buildTrapezoids = function() {
    // Set up events from line segments:
    this.createEvents();
    if(this.events.length < 4)
        return;

    // Sort events:
    var eventCmp = function(e1, e2) {
        if(e1.p.x != e2.p.x)
            return e1.p.x - e2.p.x;
        if(e1.p.y != e2.p.y)
            return e1.p.y - e2.p.y;
        return e2.end - e1.end; // Start events before end events
    }
    this.events.sort(eventCmp);

    // Prepare sweep line:
    this.sweepLine.x = this.events[0].p.x - 1;
    this.sweepLine.y = this.events[0].p.y;

    // Perform sweep line traversal:
    for(var i = 0; i < this.events.length; i++) {
        var e = this.events[i];
        if(e.end)
            this.handleEndEvent(e);
        else
            this.handleStartEvent(e);
    }
}

UTIL.evalLine = function(line, x) {
    if(x == line.p1.x)
        return line.p1.y;
    if(x == line.p2.x)
        return line.p2.y;
    return line.p1.y + (x-line.p1.x) * (line.p2.y-line.p1.y) / (line.p2.x-line.p1.x);
}

UTIL.leftTurn = function(a, b, c) {
    return (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x) > 0;
}

UTIL.TrapezoidalDecomposition.prototype.findAboveAndBelowLinesForPoint = function(p) {
    var above, below;

    function isAbove(a, b) {
        return UTIL.evalLine(a, p.x) > UTIL.evalLine(b, p.x);
    }

    for(var i = 0; i < this.sweepLine.length; i++) {
        var line = this.sweepLine[i];
        if(UTIL.leftTurn(line.p1, line.p2, p)) {
            if(!below || isAbove(line, below)) {
                below = line;                
            }
        }
        else {
            if(!above || isAbove(above, line)) {
                above = line;                
            }
        }
    }
    return [above,below];
}

UTIL.IDX = 0;
UTIL.TrapezoidalDecomposition.prototype.buildTrapezoid = function(above, below, rightX) {
    var aboveIsMoving = !above.colorAbove;
    var belowIsMoving = below.colorAbove;

    var leftX = Math.max(belowIsMoving ? below.left.x : below.p1.x, 
                         aboveIsMoving ? above.left.x : above.p1.x);
    if(leftX >= rightX) {
        return; // Trapezoid already output.
    }
    if(!aboveIsMoving && !belowIsMoving) {
        return; // Empty space.
    }

    var p1 = {x:leftX, y:UTIL.evalLine(below, leftX)};
    var p2 = {x:leftX, y:UTIL.evalLine(above, leftX)};
    var p3 = {x:rightX, y:UTIL.evalLine(above, rightX)};
    var p4 = {x:rightX, y:UTIL.evalLine(below, rightX)};

    var points = [p1];
    if(p2.y != p1.y)
        points.push(p2);
    points.push(p3);
    if(p3.y != p4.y)
        points.push(p4);
    if(points.length < 3) {
        console.warn("Degenerate trapezoid. Will not be built.");
        return;
    }

    //var colors = ['red', 'green', 'blue', 'yellow', 'orange', 'gray', 'cyan', 'purple', 'pink', 'black']; var color = colors[(UTIL.IDX++)%colors.length];
    var color = belowIsMoving ? below.color : above.color;
    this.trapezoids.push({points:points, color:color});
    if(belowIsMoving)
        below.left = p4;
    if(aboveIsMoving)
        above.left = p3;
    /*console.log(color + " x=" + leftX + "->" + rightX + 
                ", below y=" + p1.y + "->" + p4.y + ", " + below.color + (below.colorAbove?'^':'v') +
                ", above y=" + p2.y + "->" + p3.y + ", " + above.color + (above.colorAbove?'^':'v'));//*/
}

UTIL.TrapezoidalDecomposition.prototype.handleStartEvent = function(e) {
    if(this.sweepLine.length > 0 && !(this.sweepLine.x == e.p.x && this.sweepLine.y == e.p.y)) { // Empty sweep line or we were already here: Simply insert line!
        var [above, below] = this.findAboveAndBelowLinesForPoint({x:e.p.x+0.0000001, y:e.p.y});

        // Create new trapezoid and update 'below.left':
        if(below && above) {
            this.buildTrapezoid(above, below, e.p.x);
        }
    }

    this.sweepLine.push(e.line);
    this.sweepLine.x = e.p.x;
    this.sweepLine.y = e.p.y;
}

UTIL.TrapezoidalDecomposition.prototype.handleEndEvent = function(e) {
    // Find and remove line in sweep line:
    var lineIdx;
    for(var i = 0; true; i++) {
        var line = this.sweepLine[i];
        if(line.p1.x == e.line.p1.x && line.p1.y == e.line.p1.y && 
           line.p2.x == e.line.p2.x && line.p2.y == e.line.p2.y) {
            lineIdx = i;
            break;
        }
    }
    this.sweepLine.splice(lineIdx, 1);
    
    // Make trapezoids above and below line:
    var [above, below] = this.findAboveAndBelowLinesForPoint({x:e.p.x-0.0000001, y:e.p.y});

    if(above) {
        this.buildTrapezoid(above, line, e.p.x);
    }
    if(below) {
        this.buildTrapezoid(line, below, e.p.x);
    }

    this.sweepLine.x = e.p.x;
    this.sweepLine.y = e.p.y;
}

UTIL.TrapezoidalDecomposition.prototype.createEvents = function() {
    var paths = this.svgObj.paths;
    for(var i = 0; i < paths.length; i++) {
        var path = paths[i];
        var pts = path.points;
        if(pts.length < 3) {
            console.warn("Skipping events for degenerate path (" + i + ")");
            continue;
        }
        var events = [];

        var prev = pts[pts.length-1], prevprev = pts[pts.length-2];
        var minX = prev.x;
        var minTurnsLeft;
        for(var j = 0; j < pts.length; j++) {
            var p = pts[j];

            if(prev.x == minX)
                minTurnsLeft = UTIL.leftTurn(prevprev, prev, p);
            if(minX > p.x)
                minX = p.x;
            prevprev = prev;
            prev = p;

            if(prevprev.x == p.x)
                continue; // Ignore vertical lines
            var p1 = prevprev, p2 = p, colorAbove = true;
            if(p2.x < p1.x) { // Swap line points to ensure p1 is to the left of p2
                p1 = p;
                p2 = prevprev;
                colorAbove = false;
            }
            var e1 = {end:1, line:{p1:p1, p2:p2, colorAbove:colorAbove, left:p1, color:path.color}, p:p2};
            var e2 = {end:0, line:{p1:p1, p2:p2, colorAbove:colorAbove, left:p1, color:path.color}, p:p1};
            events.push(e1, e2);
        }

        if(!minTurnsLeft) {
            //console.log("Reversing winding for path " + i);
            function flip(e) {
                e.line.colorAbove = !e.line.colorAbove;
            }
            events.forEach(flip);
        }
        
        this.events.push(...events);
    }
}
