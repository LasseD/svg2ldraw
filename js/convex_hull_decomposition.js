'use strict';

/*
  Simple algorithm that turns a general shape into convex hulls.
  It is a greedy algorithm that takes the first non-concave tripple of neighboring vertices of the shape.
  This tripple sourround a convex hull. The hull is expanded by including adjacent vertices until no expansion can be performed.
  The hull is removed from the shape and the process is repeated until the shape is completely processed.
 */
UTIL.ConvexHullDecomposition = function(paths, onWarning) {
    this.paths = paths;
    this.onWarning = onWarning;
}

UTIL.ConvexHullDecomposition.prototype.build = function() {
    var hulls = [];

    // Ensure all paths turn clockwise:
    UTIL.orderPathsClockwise(this.paths);

    function handlePath(pts, color) {
        console.dir(pts);
        console.log("Building convex hulls for path of size " + pts.length);
        // Helper to check no point is inside of triangle:
        function ok(i0, i1, i2) {
            console.log('checking ' + i0 + ', ' + i1 + ', ' + i2);
            if(!UTIL.rightTurn(pts[i0], pts[i1], pts[i2])) {
                console.log('Not a right turn');
                return false;
            }
            var triangle = new UTIL.CH([pts[i0], pts[i1], pts[i2]]);
            for(var i = 0; i < pts.length; i++) {
                var p = pts[i];
                if(triangle.isInside(p)) {
                    console.log(p.x + ', ' + p.y + ' is inside from position ' + i);
                    return false;
                }
            }
            return true;
        }
 
        while(pts.length > 0) {
            var i0 = 0;//Math.floor(Math.random()*pts.length);
            const start = i0;
            while(!ok(i0, (i0+1)%pts.length, (i0+2)%pts.length)) {
                i0++;
                if(i0 == pts.length)
                    i0 = 0;
                if(i0 == start) {
                    console.dir(pts);
                    throw "Assertion error: no convex tripplet on path!";
                }
            }
            var i1 = (i0+2)%pts.length;
            var i2 = (i0+3)%pts.length;
            // Expand i1 and i2 forward:
            while(ok(i1, i2, i0)) {
                i1++;
                if(i1 == pts.length)
                    i1 = 0;
                i2 = i1+1;
                if(i2 == pts.length)
                    i2 = 0;
            }
            // TODO: Also expand the other way.

            // Now i0 -> i1 is the largest bite that can be taken.
            console.log("Extracted convex hull from " + i0 + " to " + i1);
            console.dir(pts);
            var hull;
            if(i0 == (i1+1)%pts.length) {
                hull = pts;
                pts = [];
            }
            else if(i0 < i1) {
                hull = pts.slice(i0, i1-i0);
                pts = pts.slice(0, i0).push(...pts.slice(i1));
            }
            else {
                hull = pts.slice(0, i0).push(...pts.slice(i1));
                pts = pts.slice(i0, i1-i0);
            }
            hulls.push(new UTIL.CH(hull, color));
        }
    }
    this.paths.forEach(path => handlePath(path.pts, path.color));

    this.paths = hulls;
}
