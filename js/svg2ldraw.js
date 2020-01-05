'use strict';

var SVG2LDRAW = {};
SVG2LDRAW.Precision = 3; // Used for outputting to LDraw
SVG2LDRAW.PrecisionMult = 1000;
SVG2LDRAW.MinDistDiff = 0.002;

/*
  The purpose of this library is to performs SVG to LDraw pattern transformation.
 */
SVG2LDRAW.Svg = function() {

}

SVG2LDRAW.Svg.prototype.toLDraw = function(decomposition, scaleW, scaleH, thickness, c) {
    var minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
    var maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
    
    decomposition.paths.forEach(path => path.pts.forEach(function(p) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }));
    const w = maxX-minX, h = maxY-minY;
    const midX = (maxX+minX)*0.5, midY = (maxY+minY)*0.5;

    function convert(x, mid, scale) {
        x = ((mid-x)*scale).toFixed(SVG2LDRAW.Precision);
        for(var i = 0; i < SVG2LDRAW.Precision; i++) {
            var tmp = parseFloat(x).toFixed(i);
            if(parseFloat(tmp) === parseFloat(x)) {
                return tmp; // Don't output too many '0's.
            }
        }
        return x;
    }

    var reverse = (scaleW < 0) !== (scaleH < 0);

    var cnt = 0;
    var ret = '0 Name: ' + (decomposition.name ? decomposition.name : 'INSERT_NAME_HERE');
    ret += `
0 Author: svg2ldraw
0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt
0 BFC CERTIFY CCW
`;
    function outputPath(pts, lDrawColor, y) {
        if(pts.length > 4) { // Extract a quad:
            var pts1 = pts.slice(0, 4);
            var pts2 = [ pts[0] ];
            pts2.push(...pts.slice(3));
            outputPath(pts1, lDrawColor, y);
            outputPath(pts2, lDrawColor, y);
            return;
        }
        ret += pts.length + " " + lDrawColor;
        for(var j = 0; j < pts.length; j++) {
            var k = reverse ? pts.length-1-j : j;
            ret += " " + convert(pts[k].x, midX, scaleW) + " " + y + " " + convert(pts[k].y, midY, scaleH);
        }
        ret += '\n';
        cnt++;
    }

    function scalePoints(pts) {
        return pts.map(p => new UTIL.Point(
	    Math.round((maxX-p.x)*SVG2LDRAW.PrecisionMult)/SVG2LDRAW.PrecisionMult,
	    Math.round(p.y*SVG2LDRAW.PrecisionMult)/SVG2LDRAW.PrecisionMult
	));
    }
    decomposition.paths.forEach(path => path.pts = scalePoints(path.pts));

    let allPoints = [];
    decomposition.paths.forEach(path => allPoints.push(...path.pts));
    decomposition.paths.forEach(path => outputPath(path.pts, path.lDrawColor, -thickness));

    // Add box if thickness > 0:
    if(thickness > 0) {
        let ch = new UTIL.GeneralConvexHull(allPoints);

        let pts = ch.points.map(p => {return {x:convert(p.x, midX, scaleW),
                                              y:convert(p.y, midY, scaleH)};});
        let prev = pts[pts.length-1];
        let segments = [];
        pts.forEach(p => {segments.push({p1:prev, p2:p}); prev = p;});

        var t = -thickness;
        function outputLine(coords) {
            ret += "2 24";
            coords.forEach(coord => ret += " " + coord);
            ret += '\n';
        }
        function outputQuad(coords, andLines) {
            ret += "4 " + c;
            coords.forEach(coord => ret += " " + coord);
            ret += '\n';
            cnt++;
        }

        //reverse = !reverse;
        // Sides:
        segments.forEach(line => outputQuad([line.p1.x, 0, line.p1.y, line.p1.x, t, line.p1.y,
                                             line.p2.x, t, line.p2.y, line.p2.x, 0, line.p2.y]));
        // Lines above:
        segments.forEach(line => outputLine([line.p1.x, 0, line.p1.y, line.p2.x, 0, line.p2.y]));
        // Lines below:
        segments.forEach(line => outputLine([line.p1.x, t, line.p1.y, line.p2.x, t, line.p2.y]));
        // Lines on sides
        segments.forEach(line => outputLine([line.p1.x, 0, line.p1.y, line.p1.x, t, line.p1.y]));
        // Below:
        outputPath(ch.points, c, 0);
    }

    return ret;
}