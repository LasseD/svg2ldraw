'use strict';

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

  Strateggy for handling intersections:
  - A path with self-intersections can currently not be handled.
  - If to paths intersect, then the 'append' functionality can be used.
 */
UTIL.TrapezoidalDecomposition = function(svgObj) {
    this.paths = svgObj.paths;
    this.events = [];
    this.sweepLine = [];
    this.trapezoids = [];
    this.width = svgObj.width;
    this.height = svgObj.height;
}

UTIL.TrapezoidalDecomposition.prototype.sortEvents = function() {
    const eventCmp = function(e1, e2) {
        if(e1.p.x != e2.p.x)
            return e1.p.x - e2.p.x;
        if(e1.end != e2.end)
            return e2.end - e1.end; // Start events before end events on sweep line.
        return e1.p.y - e2.p.y;
    }
    this.events.sort(eventCmp);
}

/*
  Perform sweep line algorithm.
 */
UTIL.TrapezoidalDecomposition.prototype.buildTrapezoids = function() {
    var ok = true;
    // Ensure all paths turn clockwise:
    this.orderPathsClockwise();

    // Set up events from line segments:
    this.createEvents();
    if(this.events.length < 4) {
	console.warn("Too few events for a decomposition.");
        return;
    }

    // Sort events:
    this.sortEvents();

    if(this.detectCrossingLines()) {
        ok = false;
        if(this.paths.length > 1)
            return ok; // Crossing lines from multiple paths - Topology can't be created. 
        // TODO: Update lines to allow continuation
    }

    // Compute topology in order to be able to set colors of trapezoids:
    this.computeTopology();
    //console.log('Topology'); console.dir(this);

    // Prepare sweep line:
    this.x = this.events[0].p.x - 1;
    this.y = this.events[0].p.y;

    // Perform sweep line traversal:
    for(var i = 0; i < this.events.length; i++) {
        const e = this.events[i];
        if(e.end)
            this.handleEndEvent(e);
        else
            this.handleStartEvent(e);
    }
    return ok;
}

UTIL.TrapezoidalDecomposition.prototype.detectCrossingLines = function() {
    // Perform sweep line traversal:
    var cnt = 0;
    var p = this.events[this.events.length-1].p;
    var atP = 1;

    for(var j = 0; j < this.events.length; j++) {
        const e = this.events[j];
        if(e.p.equals(p)) {
            atP++;
            if(atP > 2) {
                console.warn('More than two lines meet at ' + p.x + ',' + p.y);
                cnt++;
            }
        }
        else{
            p = e.p;
            atP = 1;
        }

        if(e.end) { // Find and remove line in sweep line:
            for(var i = 0; i < this.sweepLine.length; i++) {
                const line = this.sweepLine[i];
                if(line.p1.x == e.line.p1.x && line.p1.y == e.line.p1.y && 
                   line.p2.x == e.line.p2.x && line.p2.y == e.line.p2.y) {
                    if(line.pathIdx == e.line.pathIdx) {
                        this.sweepLine.splice(i, 1);
                    }
                    else {
                        console.warn('Overlapping lines at ' + e.p.x + ", " + e.p.y);
                        cnt++;
                    }
                }
            }
        }
        else {
            for(var i = 0; i < this.sweepLine.length; i++) {
                const line = this.sweepLine[i];
                if(e.line.crossesLineSegment(line.p1, line.p2)) {
                    var c = e.line.getIntersectionWithLine(line.p1, line.p2);
                    console.warn("Lines cross at " + c.x + ", " + c.y);
                    cnt++;
                }
            }
            this.sweepLine.push(e.line);
        }
    }
    return cnt > 0;
}

UTIL.TrapezoidalDecomposition.prototype.computeTopology = function() {
    // Perform sweep line traversal:
    for(var j = 0; j < this.events.length; j++) {
        const e = this.events[j];
        if(e.end) { // Find and remove line in sweep line:
            for(var i = 0; true; i++) {
                const line = this.sweepLine[i];
                if(line.p1.x == e.line.p1.x && line.p1.y == e.line.p1.y && 
                   line.p2.x == e.line.p2.x && line.p2.y == e.line.p2.y) {
                    this.sweepLine.splice(i, 1);
                    break;
                }
            }
        }
        else { // For the first event of a path, compute neighbour:
            if(!e.path.neighbour) {
                const [above, below] = this.findLinesAboveAndBelow(e, true);
                /*console.log('HANDLING PATH');
                console.dir(e);
                console.dir(above);
                console.dir(below);*/
                if(below) {
                    e.path.neighbour = below.path;
                    if(below.interiorIsAbove) {
                        e.path.outerPath = below.path;
                    }
                    else {
                        e.path.outerPath = below.path.outerPath;
                    }
                }
                else {
                    e.path.neighbour = e.path.outerPath = this; // Decomposition is root.
                }
            }            
            this.sweepLine.push(e.line);
        }
    }
}

UTIL.TrapezoidalDecomposition.prototype.findLinesAboveAndBelow = function(e, aBitToTheRight) {
    const x = e.p.x + (aBitToTheRight ? 0.00001 : -0.00001);
    const p = new UTIL.Point(x, e.line.eval(x));

    var above, below;

    function isAbove(a, b) {
        var ea = a.eval(x), eb = b.eval(x);
        return ea > eb || (ea == eb && a.interiorIsAbove && !b.interiorIsAbove);
    }

    for(var i = 0; i < this.sweepLine.length; i++) {
        const line = this.sweepLine[i];

        if(line.leftTurn(p)) {
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
    const aboveInsideIsMoving = !above.interiorIsAbove;
    const belowInsideIsMoving = below.interiorIsAbove;
    const leftX = Math.max(belowInsideIsMoving ? below.leftInside.x : below.leftOutside.x,
                           aboveInsideIsMoving ? above.leftInside.x : above.leftOutside.x);
    if(leftX >= rightX) {
        return; // Trapezoid already output.
    }

    const p1 = new UTIL.Point(leftX, below.eval(leftX));
    const p2 = new UTIL.Point(leftX, above.eval(leftX));
    const p3 = new UTIL.Point(rightX, above.eval(rightX));
    const p4 = new UTIL.Point(rightX, below.eval(rightX));

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

    var color = belowInsideIsMoving ? below.path.color : below.path.outerPath.color;
    //if(color){var colors = ['#FBB', '#FBF', '#F00', '#0F0', '#00F', '#FF0', '#0FF', '#F0F', '#000', '#FFF']; var color = colors[(UTIL.IDX++)%colors.length];}
    if(color) {
        this.trapezoids.push(new UTIL.CH(points, color));
        /*console.log(color + " x=" + leftX + "->" + rightX + 
                    ", below y=" + p1.y + "->" + p4.y + (below.interiorIsAbove?'^':'v') + (belowInsideIsMoving ? 'below is moving' : below.path.outerPath.color) +
                    ", above y=" + p2.y + "->" + p3.y + (above.interiorIsAbove?'^':'v'));
        console.dir(below);
        console.dir(above);//*/
    }
    
    if(belowInsideIsMoving)
        below.leftInside = p4;
    else
        below.leftOutside = p4;
    if(aboveInsideIsMoving)
        above.leftInside = p3;
    else
        above.leftOutside = p3;
}

UTIL.TrapezoidalDecomposition.prototype.handleStartEvent = function(e) {
    //console.log('START ' + e.p.x + ', ' + e.p.y);
    // Output trapezoids to the left of event:
    if(this.sweepLine.length > 0 && !(this.x == e.p.x && this.y == e.p.y)) {
        const [above, below] = this.findLinesAboveAndBelow(e, true);
        if(below && above) {
            this.buildTrapezoid(above, below, e.p.x);
        }
    }

    this.sweepLine.push(e.line);
    this.x = e.p.x;
    this.y = e.p.y;
}

UTIL.TrapezoidalDecomposition.prototype.handleEndEvent = function(e) {
    //console.log('END ' + e.p.x + ', ' + e.p.y);
    // Find and remove line in sweep line:
    var line;
    for(var i = 0; true; i++) {
        line = this.sweepLine[i];
        if(line.p1.x == e.line.p1.x && line.p1.y == e.line.p1.y && 
           line.p2.x == e.line.p2.x && line.p2.y == e.line.p2.y) {
            this.sweepLine.splice(i, 1);
            break;
        }
    }
    
    // Make trapezoids above and below line:
    const [above, below] = this.findLinesAboveAndBelow(e, false);

    if(above) {
        this.buildTrapezoid(above, line, e.p.x);
    }
    if(below) {
        this.buildTrapezoid(line, below, e.p.x);
    }

    this.x = e.p.x;
    this.y = e.p.y;
}

UTIL.TrapezoidalDecomposition.prototype.orderPathsClockwise = function() {
    for(var i = 0; i < this.paths.length; i++) {
        const path = this.paths[i];
        const pts = path.pts;
        if(pts.length < 3) {
            continue;
        }

        var prev = pts[pts.length-1], prevprev = pts[pts.length-2];
        var minX = prev.x+1, minY;
        var minTurnsLeft;
        for(var j = 0; j <= pts.length; j++) {
            const p = pts[j % pts.length];

            if(minX > prev.x || (minX == prev.x && minY > prev.y)) {
                minTurnsLeft = UTIL.leftTurn(prevprev, prev, p);
                minX = prev.x;
                minY = prev.y;
            }
            prevprev = prev;
            prev = p;
        }

        if(!minTurnsLeft) {
            //console.log('Flipping path ' + i + ' with ' + pts.length + ' points');
            pts.reverse();
            path.reversed = true;
        }
    }    
}

UTIL.TrapezoidalDecomposition.prototype.createEvents = function() {
    for(var i = 0; i < this.paths.length; i++) {
        const path = this.paths[i];
        const pts = path.pts;
        if(pts.length < 3) {
            console.warn("Skipping events for degenerate path (" + i + ")");
            continue;
        }

        var prev = pts[pts.length-1];
        for(var j = 0; j < pts.length; j++) {
            const p = pts[j];

            if(prev.x == p.x) {
                prev = p;
                continue; // Ignore vertical lines
            }
            var p1 = prev, p2 = p, interiorIsAbove = true;
            if(p2.x < p1.x) { // Swap line points to ensure p1 is to the left of p2
                p1 = p;
                p2 = prev;
                interiorIsAbove = false;
            }
            const l1 = new UTIL.Line(p1, p2), l2 = new UTIL.Line(p1, p2);
            l1.path = l2.path = path;
            l1.pathIdx = l2.pathIdx = i;
            l1.interiorIsAbove = l2.interiorIsAbove = interiorIsAbove;
            l1.leftInside = l1.leftOutside = l2.leftInside = l2.leftOutside = p1;

            const e1 = {end:0, path:path, p:p1, line:l1, pathIdx:i};
            const e2 = {end:1, path:path, p:p2, line:l2, pathIdx:1};
            this.events.push(e1, e2);
            prev = p;
        }
    }
}
