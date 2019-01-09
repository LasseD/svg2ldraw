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
}

/*
  Perform sweep line algorithm.
 */
UTIL.TrapezoidalDecomposition.prototype.buildTrapezoids = function() {
    // Set up events from line segments:
    var events = this.createEvents();

    // Sort events:
    function eventCmp(e1, e2) {
        if(e1.p.x != e2.p.x)
            return e2.p.x-e1.p.x;
        if(e1.p.y != e2.p.y)
            return e2.p.y-e1.p.y;
        if(e1.end != e2.end) {
            //TODO Start events before end events
        }
        
        //TODO
    }
    events.sort(eventCmp);

    var ret = [];
    // Perform sweep line traversal:
    // TODO

    return ret;
}

UTIL.TrapezoidalDecomposition.prototype.createEvents = function() {
    var events = [];
    var paths = this.svgObj.paths;
    for(var i = 0; i < paths.length; i++) {
        var path = paths[i];
        var prev = path[path.length];
        for(var j = 0; j < path.length; j++) {
            var p = path[j];
            if(prev.x == p.x)
                continue; // Ignore vertical lines
            var line = {p1: prev, p2: p, color:path.color};
            if(line.p2.x < line.p1.x) { // Swap line points to ensure p1 is to the left of p2
                line.p1 = p;
                line.p2 = prev;
            }
            line.left = line.p1; // Used by algorithm state.
            var e1 = {end:false, line:line, p:line.p1};
            var e2 = {end:true, line:line, p:line.p2};
            events.push(e1, e2);
        }
    }
    return events;
}


