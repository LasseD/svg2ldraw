'user strict';

UTIL.PathSimplification = function(pointsPerPixel) {
    this.bezierRemover = new UTIL.BezierRemover(pointsPerPixel);
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
    return this.simplifySvgDom(svg);
}

UTIL.PathSimplification.prototype.simplifySvgDom = function(svg) {
    var svgObj = {width: Number(svg.attributes.width.value), 
                  height: Number(svg.attributes.height.value),
                  bg: 0, // TODO
                  paths: []};

    var paths = svg.getElementsByTagName('path');
    for(var i = 0; i < paths.length; i++) {
        var path = paths[i];
        var d = path.attributes.d.value;
        var c = '#000000';
        if(path.attributes.fill) {
            c = path.attributes.fill.value;
        }
        else if(path.attributes.style) {
            var style = path.attributes.style.value;
            var fill = style.match(/(?:fill\:\s*)([\w\#]+)\;/);
            if(fill)
                c = fill[1];
        }
        this.handlePathD(d, svgObj.paths, c);
    }

    return svgObj;
}

UTIL.PathSimplification.prototype.decompositionToSvg = function(w, h, decomposition) {
    var svg = {width:w, height:h, paths:decomposition.trapezoids};
    return this.svgObjToSvg(svg);
}

UTIL.PathSimplification.prototype.svgObjToSvg = function(svgObj) {
    var ret = '<svg width="' + svgObj.width + '" height="' + svgObj.height + '" xmlns="http://www.w3.org/2000/svg">\n';

    function shorten(x) {
        if(x == Math.floor(x))
          return x;
        return x.toFixed(3);
    }

    for(var i = 0; i < svgObj.paths.length; i++) {
        var path = svgObj.paths[i];
        var p = path.points;
        ret += '  <path d="M ' + shorten(p[0].x) + ' ' + shorten(p[0].y) + ' ';

        for(var j = 1; j < p.length; j++) {
            var x = shorten(p[j].x);
            var y = shorten(p[j].y);
            ret += 'L ' + x + ' ' + y + ' ';
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

    function push() {
        if(p.length > 0) {
            var first = p[0];
            var last = p[p.length-1];
            if(first.x == x && first.y == y)
                return;
            if(last.x == x && last.y == y)
                return;
        }
        p.push(new UTIL.Point(x,y));
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
            push();
            break;
        case 'Z':
        case 'z':
            if(p.length == 0)
                break;
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
            push();
            break;
        case 'H':
            x = 0;
        case 'h':
            x = x+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            push();
            break;
        case 'V':
            y = 0;
        case 'v':
            y = y+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            push();
            break;
        case 'C':
            var x1 = Number(tokens[++i]);
            var y1 = Number(tokens[++i]);
            var x2 = Number(tokens[++i]);
            var y2 = Number(tokens[++i]);
            var x3 = Number(tokens[++i]);
            var y3 = Number(tokens[++i]);
            var p0 = new UTIL.Point(x, y);
            var p1 = new UTIL.Point(x1, y1);
            var p2 = new UTIL.Point(x2, y2);
            var p3 = new UTIL.Point(x3, y3);
            var curvePoints = this.bezierRemover.handleCurve(p0, p1, p2, p3);
            for(var k = 0; k < curvePoints.length; k++) {
                x = curvePoints[k].x;
                y = curvePoints[k].y;
                push();
            }
            x = x3;
            y = y3;
            if(x == p[0].x && y == p[0].y)
                closePath();
            break;
        case 'c':
            throw "Cubic bezier curve with additive coordinates not yet supported.";
        default:
            throw "Unsupported svg path command: " + cmd;
        }
    }
}



