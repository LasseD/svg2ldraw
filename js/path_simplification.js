var UTIL = {};

UTIL.PathSimplification = function(pointsPerCurve) {
    this.pointsPerCurve = pointsPerCurve;
}

/*
  Assumes a path like the following (see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths ):

  <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">  
    <path d="M10 10 H 90 V 90 H 10 L 10 10"/>
  </svg>

  Returns a structured object with the simplified paths:
  {width, height
 */
UTIL.PathSimplification.prototype.simplifySvg = function(svgAsText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgAsText, "text/xml");
    var svg = doc.children[0];

    var svgObj = {width: Number(svg.attributes.width.value), 
                  height: Number(svg.attributes.height.value), 
                  paths: []};

    var paths = doc.getElementsByTagName('path');
    for(var i = 0; i < paths.length; i++) {
        var path = paths[i];
        var d = path.attributes.d.value;
        var fill = path.attributes.fill;
        var c = 'black';
        if(fill) {
            c = fill.value;
        }
        this.handlePathD(d, svgObj.paths, c);
    }

    return svgObj;
}

UTIL.PathSimplification.prototype.svgObjToSvg = function(svgObj) {
    var ret = '<svg width="' + svgObj.width + '" height="' + svgObj.height + '" xmlns="http://www.w3.org/2000/svg">\n';
    for(var i = 0; i < svgObj.paths.length; i++) {
        var path = svgObj.paths[i];
        var p = path.points;
        ret += '  <path d="M ' + p[0].x + ' ' + p[0].y + ' ';

        for(var j = 1; j < p.length; j++) {
            ret += 'L ' + p[j].x + ' ' + p[j].y + ' ';
        }
        ret += 'Z" fill="' + path.color +'"/>\n';
    }
    ret += '</svg>';
    return ret;
}

/*
  Handles the d-attribute (path content) of a path.
  Assumptions:
  - First command of any subpath is 'M' or 'm'.
  - Each path ends with is 'Z', 'z' or 'L x0 y0' where x0, y0 is the position of the first M or m command.
  - A path doesn't self-intersect, not have overlapping positions (except the two path end points).
 */
UTIL.PathSimplification.prototype.handlePathD = function(d, outputPaths, color) {
    var tokens = d.match(/[a-zA-Z]+|[0-9\.\-]+/gi);
    var x = 0, y = 0; // Current position.
    var p = []; // Current path.

    function closePath() {
        if(p && p.length >= 3) {
            outputPaths.push({points:p, color:color});
        }
        p = [];
    }

    for(var i = 0; i < tokens.length; i++) {
        var cmd = tokens[i];
        switch(cmd) {
        case 'M':
            x = y = 0;
        case 'm':
            closePath();
            x = x+Number(tokens[++i]);
            y = y+Number(tokens[++i]);
            p.push({x:x, y:y});
            break;
        case 'Z':
        case 'z':
            x = p[0].x;
            y = p[0].y;
            closePath();
            break;
        case 'L':
            x = y = 0;
        case 'l':
            x = x+Number(tokens[++i]);
            y = y+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            p.push({x:x, y:y});
            break;
        case 'H':
            x = 0;
        case 'h':
            x = x+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            p.push({x:x, y:y});
            break;
        case 'V':
            y = 0;
        case 'v':
            y = y+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            p.push({x:x, y:y});
            break;
        case 'C':
            // var c = new UTIL.BezierRemover(pointsPerCurve).handleSvg(this.content);
            //c = UTIL.simplifySvgPaths(c); // TODO: Find the right way to do this.
            throw "Cubic bezier curve not yet supported.";
        case 'c':
            throw "Cubic bezier curve not yet supported.";
        default:
            throw "Unknown svg path command: " + cmd;
        }
    }
}



