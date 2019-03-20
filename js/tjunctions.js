/*
  T-junctions can cause rendering issues. See: https://wiki.ldraw.org/wiki/T-Junction
  The T-junction handler attemps to remove T-junctions from paths by adding points to
  paths where they are shared with points from other paths.
 */
UTIL.TJunctionHandler = function(onWarning) {
    this.onWarning = onWarning || function(type, msg){ console.warn(msg); } ;
}

/*
  This function adds points to the paths.

  Consider the point cloud S from the paths.
  For each path, points from S are added to the path if they lie on the line segments of it.

  Input: Array of UTIL.Path or UTIL.CH objects (both have pts and color as properties)
  Output: Array of UTIL.Path objects.
 */
UTIL.TJunctionHandler.prototype.addPoints = function(paths) {
    // First extract and sort the point cloud S:
    var S = [];
    paths.forEach(path => S.push(...path.pts));
    S.sort(UTIL.PointCompare);
    S = S.filter((p, idx, a) => idx == 0 || (p.x != a[idx-1].x || p.y != a[idx-1].y)); // Filter unique.

    // Handle each path:
    var ret = [];
    // TODO: Maintain window in S while traversing in order to speed up the time for comparing... this is why we sorted the points!
    function handlePath(path) {
        var newPoints = [];
        var prev = path.pts[path.pts.length-1];
        var pts = [prev];
        for(var i = 0; i < path.pts.length; i++) {
            var p = path.pts[i];
            var line = new UTIL.Line(prev, p);

            // Get all points s in S intersecting the line in sorted order:
            var intersectionPoints = S
                .map(function(s) {return {p:s, intersection:line.lineSegmentPointIntersection(s)}})
                .filter(x => 0 < x.intersection && 1 > x.intersection)
                .sort((a, b) => a.intersection - b.intersection)
                .map(x => x.p)
                .filter((p, idx, a) => idx === 0 || !a[idx-1].equals(p));
            /*if(intersectionPoints.length) {
                console.log('Adding ' + intersectionPoints.length + ' points between ' + prev.x + ',' + prev.y + ' and ' + p.x + ',' + p.y + ':');
                intersectionPoints.forEach(p => console.log(' ' + p.x + ', ' + p.y));
            }//*/
            newPoints.push(...intersectionPoints);

            prev = p;
            newPoints.push(p);
        }
        ret.push(new UTIL.Path(newPoints, path.color));
    }
    paths.forEach(handlePath);

    return ret;
}
