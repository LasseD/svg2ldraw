'use strict';

/*
  Simple algorithm that turns a general shape into convex hulls.
  It is a greedy algorithm that takes the first non-concave tripple of neighboring vertices of the shape.
  This tripple surrounds a convex hull. The hull is expanded by including adjacent vertices until no expansion can be performed.
  The hull is removed from the shape and the process is repeated until the shape is completely processed.
 */
UTIL.ConvexHullDecomposition = function(paths, onWarning) {
    this.paths = paths;
    this.onWarning = onWarning;
}

UTIL.ConvexHullDecomposition.prototype.build = function() {
    var self = this;
    var hulls = [];

    // Ensure all paths turn clockwise:
    UTIL.orderPathsClockwise(this.paths);

    function handlePath(path) {
        //console.log('Handling: ' + path.toSvg());
        var pts = path.pts;
        var color = path.color;

        function rt(i0, i1, i2) {
            return !UTIL.leftTurn(pts[i0], pts[i1], pts[i2]);
        }

        // Helper to check no point is inside of triangle:
        function ok(i0, i1, i2) {
            //console.warn('checking ' + i0 + ', ' + i1 + ', ' + i2);
            //console.dir(pts);
            if(!rt(i0, i1, i2)) {
                //console.log('Not a right turn');
                return false;
            }
            var p0 = pts[i0], p1 = pts[i1], p2 = pts[i2];
            if(UTIL.noTurn(p0, p1, p2)) {
                //console.warn('Inline points on hull - skipping');
                return true;
            }
            var triangle = new UTIL.CH([p0, p1, p2]);
            for(var i = 0; i < pts.length; i++) {
                var p = pts[i];
                if(p.equals(p0) || p.equals(p1) || p.equals(p2)) {
                    continue; // Own points
                }
                if(triangle.isOnOrInside(p)) {
                    //console.log(p.x + ', ' + p.y + ' is inside from position ' + i);
                    return false;
                }
            }
            return true;
        }

        //console.dir(pts);
        while(pts.length > 0) {
            pts = UTIL.removeInlinePoints(pts);
            //console.log('PREPARED POINTS'); console.dir(pts);

            var i0 = 0;//TODOMath.floor(Math.random()*pts.length);
            var start = i0;
            // Expand (walk forward to) first concave or consuming point (in any exists):
            while(ok(i0, (i0+1)%pts.length, (i0+2)%pts.length)) {
                i0++;
                if(i0 === pts.length) {
                    i0 = 0;
                }
                if(i0 === start) {
                    break; // All are convex and non-consuming, so any will do.
                }
            } // Now we know !ok(i0...) or all ok(...).
            start = i0; 
            //console.log('START: ' + start);
            while(!ok(i0, (i0+1)%pts.length, (i0+2)%pts.length)) {
                //console.log('Failed test for index ' + i0);
                i0++;
                if(i0 === pts.length) {
                    i0 = 0;
                }
                if(i0 === start) {
                    console.dir(pts);
                    self.onWarning('non-consuming', "No convex non-consuming tripplet on path: " + path.toSvg());
                    return; // No output.
                }
            }

            const i0Next = (i0+1)%pts.length; // Right after i0
            var i1Prev = i0Next; // Right before i1
            var i1 = (i0+2)%pts.length;
            var i2 = (i0+3)%pts.length;
            /*
              Expand i1 forward:
             */
            while(i2 !== i0 && rt(i2, i0, i0Next) && rt(i1Prev, i1, i2) && ok(i1, i2, i0)) {
                i1Prev = i1;
                i1 = i2;
                i2++;
                if(i2 === pts.length) {
                    i2 = 0;
                }
            }

            // Now i0 -> i1 is the largest bite that can be taken.
            //console.log("Extracted convex hull from " + i0 + " to " + i1);
            var hull;
            if(i0 === (i1+1)%pts.length) {
                hull = pts;
                pts = [];
            }
            else if(i0 < i1) {
                //console.log('a');
                hull = pts.slice(i0, i1+1);
                var tmp = pts;
                pts = pts.slice(0, i0+1);
                pts.push(...tmp.slice(i1));
            }
            else {
                //console.log('b');
                hull = pts.slice(0, i1+1);
                hull.push(...pts.slice(i0));
                pts = pts.slice(i1, i0+1);
            }
            //color = UTIL.COLORS[(UTIL.IDX++)%UTIL.COLORS.length];
            //console.log('Hull generated:');
            //console.dir(hull);
            //console.log('Remaining:');
            //console.dir(pts);
            try {
                hulls.push(new UTIL.CH(hull, color));
            }
            catch(e) {
                console.dir(e);
                self.onWarning('CH construction', e);
            }
        }
    }
    this.paths.forEach(handlePath);

    this.paths = hulls;
}
