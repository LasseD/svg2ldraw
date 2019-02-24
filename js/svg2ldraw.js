'use strict';

var SVG2LDRAW = {};
SVG2LDRAW.Precision = 4; // Used for outputting to LDraw
SVG2LDRAW.PrecisionMult = 10000;
SVG2LDRAW.MinDistDiff = 0.0002;

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the commands mentioned in path_simplification.js
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
            if(parseFloat(tmp) == parseFloat(x)) {
                return tmp; // Don't output too many '0's.
            }
        }
        return x;
    }

    var reverse = (scaleW < 0) != (scaleH < 0);

    var cnt = 0;
    var ret = '0 Name: ' + (decomposition.name ? decomposition.name : 'INSERT_NAME_HERE');
    ret += `
0 Author: svg2ldraw
0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt
0 BFC CERTIFY CCW
`;
    function outputPath(path) {
        if(path.pts.length > 4) { // Extract a quad:
            var path1 = {pts:path.pts.slice(0, 4), lDrawColor:path.lDrawColor};
            var pts2 = [ path.pts[0] ];
            pts2.push(...path.pts.slice(3));
            var path2 = {pts:pts2, lDrawColor:path.lDrawColor};
            outputPath(path1);
            outputPath(path2);
            return;
        }
        const pts = path.pts;
        ret += pts.length + " " + path.lDrawColor;
        for(var j = 0; j < pts.length; j++) {
            var k = reverse ? pts.length-1-j : j;
            ret += " " + convert(pts[k].x, 0, -1) + " " + (-thickness) + " " + convert(pts[k].y, 0, -1);
        }
        ret += '\n';
        cnt++;
    }

    var skipped = 0;
    function handlePath(path) {
        var pts = path.pts.map(p => new UTIL.Point(
	    Math.round((midX-p.x)*scaleW*SVG2LDRAW.PrecisionMult)/SVG2LDRAW.PrecisionMult,
	    Math.round((midY-p.y)*scaleH*SVG2LDRAW.PrecisionMult)/SVG2LDRAW.PrecisionMult
	));
	
	try {
            var clean = new UTIL.CH(pts, path.color, ((a,b) => a.dist(b) < SVG2LDRAW.MinDistDiff));
            outputPath({pts:clean.pts.map(p => new UTIL.Point(-p.x, p.y)), lDrawColor:path.lDrawColor});
	}
	catch(exception) {
	    //console.dir(exception);
            skipped++;
        }        
    }

    decomposition.paths.forEach(handlePath);

    // `Add box if thickness > 0:
    if(thickness > 0) {
        console.log('Adding box due to thickness being ' + thickness);
        minX = convert(minX, midX, -scaleW);
        maxX = convert(maxX, midX, -scaleW);
        minY = convert(minY, midY, scaleH);
        maxY = convert(maxY, midY, scaleH);
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
            if(andLines) {
                outputLine([coords[0], coords[1], coords[2], coords[3], coords[4], coords[5]]);
                outputLine([coords[3], coords[4], coords[5], coords[6], coords[7], coords[8]]);
                outputLine([coords[6], coords[7], coords[8], coords[9], coords[10], coords[11]]);
                outputLine([coords[9], coords[10], coords[11], coords[0], coords[1], coords[2]]);
            }
        }
        // Below:
        outputQuad([maxX, 0, maxY, minX, 0, maxY, minX, 0, minY, maxX, 0, minY], true);
        // 4 sides:
        outputQuad([minX, 0, minY, minX, t, minY, maxX, t, minY, maxX, 0, minY], false);
        outputQuad([maxX, 0, maxY, maxX, t, maxY, minX, t, maxY, minX, 0, maxY], false);
        outputQuad([minX, 0, maxY, minX, t, maxY, minX, t, minY, minX, 0, minY], false);
        outputQuad([maxX, 0, minY, maxX, t, minY, maxX, t, maxY, maxX, 0, maxY], false);
        // Lines above:
        outputLine([maxX, 0, maxY, minX, 0, maxY]);
        outputLine([minX, 0, maxY, minX, 0, minY]);
        outputLine([minX, 0, minY, maxX, 0, minY]);
        outputLine([maxX, 0, minY, maxX, 0, maxY]);
        // Lines on sides
        outputLine([maxX, 0, maxY, maxX, t, maxY]);
        outputLine([minX, 0, maxY, minX, t, maxY]);
        outputLine([minX, 0, minY, minX, t, minY]);
        outputLine([maxX, 0, minY, maxX, t, minY]);

        cnt += 5;
    }

    console.log('Built lDraw file from ' + cnt + ' triangles and quads. ' + skipped + ' skipped.');
    return ret;
}