(function() {
function createCookie(name,value,days) {
	var expires;
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		expires = "; expires="+date.toGMTString();
	}
	else expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

$(document).ready(function(){
	now.ready(function() {
		var delay;
		var previewFrame = $('#preview > iframe')[0];
		var splitSize = readCookie('splitsize');
		var filesComboId = "#files";
		var delFileButton = $("#removeFile");
        var slideTemplates = "#templates";
        var currentTemplate;
        var totalSlides;
		var selectedSlide;
		
		var fileName = "";
		var isFileModified = false;
		var onLoadFile = false;

        for(var t in slideTemplate){
            var flag = true;
            if(flag){
                $(slideTemplates).val(t);
                currentTemplate = slideTemplate[t].code;
                flag = false;
            }
            $(slideTemplates).append("<option value='"+t+"'>"+slideTemplate[t].title+"</option>");
        }

        $(slideTemplates).change(function() {
            var t = $(this).val();
            if (t != ""){
                currentTemplate = slideTemplate[t].code;
            }
        });


		$(window).bind('hashchange', function() {
			selectedSlide = parseInt(window.location.hash.replace('#', '')) - 1;
			if (!selectedSlide || selectedSlide < 0) { selectedSlide = 0; }

            $("#selectedSlide").html(selectedSlide + 1);

            if(selectedSlide == 0){
                $("a[data-tool=prev]").addClass("disabled");
            }
            else{
                $("a[data-tool=prev]").removeClass("disabled");
            }
            if(totalSlides && selectedSlide == totalSlides-1){
                $("a[data-tool=next]").addClass("disabled");
            }
            else{
                $("a[data-tool=next]").removeClass("disabled");
            }

		});

        $('#preview > iframe').load(function (){
            totalSlides = previewFrame.contentWindow.slideEls.length;
            $("#totalSlides").html(totalSlides);

            $(window).trigger('hashchange');
        });
		
		if (!splitSize) {
			splitSize = $(document).width() / 2;
		}

		var editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
			mode: 'text/html',
			//closeTagEnabled: false, // Set this option to disable tag closing behavior without having to remove the key bindings.
			lineNumbers: true,
			lineWrapping: true,
			extraKeys: {
				"'>'": function(cm) {try{ cm.closeTag(cm, '>'); }catch(err){ if(err== CodeMirror.Pass) autoEncodePre(cm, '>');}},
				"'/'": function(cm) { cm.closeTag(cm, '/'); },
				"'<'": function(cm) { autoEncodePre(cm, '<');}
			},
			onChange: function() {
				clearTimeout(delay);
				delay = setTimeout(updatePreview, 300);
				if(!onLoadFile){
					isFileModified = true;
				}else{
					onLoadFile = false;
					isFileModified = false;
				}
			},
			onCursorActivity: function() {
				selectedSlide = getSlideInfoOnCursor();
				if(selectedSlide != -1 && previewFrame.contentWindow.curSlide != selectedSlide) {
					previewFrame.contentWindow.gotoSlide(selectedSlide);
				}
			}
		});

		function setSplitAt(value) {
			value = Math.max(50, Math.min(value, $(document).width() - 50));

			var leftSize = value;
			var rightSize = $(document).width() - value;

			$("#code").css({right: rightSize + 2});
			$("#preview").css({left: leftSize + 2});
			$("#splitter").css({left: leftSize - 2});

			editor.refresh();

			splitSize = value;
		}
		
		function fillFilesCombobox(){
			for (var cle in localStorage){
				if(cle.substr(0,7) == "slides_"){
					cle = cle.substr(7,cle.length);
					$(filesComboId).append("<option value='"+cle+"'>"+cle+"</option>");
				}
			}
		}
		
		$(filesComboId).change(function() {
			if ($(this).val() != ""){
				if (localStorage) {
					if(isFileModified){
						if (confirm("File not saved. Do you want to save it before switch?")) {
							if(fileName == ""){
								saveAsFile();
							}else{
								saveFile(fileName);
							}
						}
					}
					fileName = $(this).val();
					onLoadFile = true;
					editor.setValue(localStorage["slides_"+fileName]);
				} else {
					alert("'localStorage' not supported by your navigator!");
				}
			}
		});
		
		function saveAsFile(){
			var name = "";
			while(name == ""){
				name = prompt("Enter the name of the presentation");
			}
			if(name==null) return;
			
			if (localStorage) {
				if(localStorage["slides_"+name] != null){
					if (!confirm("That name already exists! Do you want overwrite this file?")) {
						return;
					}
				}else{
					$(filesComboId).append("<option value='"+name+"'>"+name+"</option>");
					$(filesComboId).val(name);
				}
			} else {
				alert("Functionality not supported by your navigator!");
			}
			saveFile(name);
			fileName = name;
		}
		
		function saveFile(name){
			if (localStorage) {
				localStorage["slides_"+name] = editor.getValue();
				isFileModified = false;
			} else {
				alert("Functionality not supported by your navigator!");
			}
		}
		
		function removeFile(name){
			if (localStorage) {
				if(name != ""){
					if (!confirm("Are you sure you want to delete : " + name + "?")) {
						return;
					}
					localStorage.removeItem("slides_"+name);
					$(filesComboId+" option:selected").remove();
					fileName = "";
					isFileModified = true;
				}
			} else {
				alert("Functionality not supported by your navigator!");
			}
		}

		var dragHandler = function(e) {
			setSplitAt(e.pageX);
		};

		var releaseHandler = function() {
			$(document).unbind('mousemove', dragHandler);
			$(document).bind('mouseup', releaseHandler);

			$('#dragSurface').remove();

			createCookie('splitsize', splitSize, 365);
		};

		$('#splitter').mousedown(function() {
			$(document).bind('mousemove', dragHandler);
			$(document).bind('mouseup', releaseHandler);

			$('body').append($('<div id="dragSurface"></div>'));

			return false;
		});

        // Each index corresponds to an index tag, its value equals true for start tag and false for end tag.
        // A table of those indexes is returned.
        function getTagIndexes(szText, szTag, bWithAttr) {
            var startTag = bWithAttr ? '<' + szTag : '<' + szTag + '>';
            var endTag = '</' + szTag + '>'

            var tags = [];

            var pos = szText.indexOf(startTag);
            while (pos != -1) {
                tags[pos] = true;
                pos = szText.indexOf(startTag, pos+1);
            }

            pos = szText.indexOf(endTag);
            while (pos != -1) {
                tags[pos] = false;
                pos = szText.indexOf(endTag, pos+1);
            }
            return tags;
        }

        // Return the current slide compared with to the cursor position.
		function getSlideInfoOnCursor() {
			var tags = getTagIndexes(editor.getValue(), "article", true);
			var iLevel = 0;
			var iCurrentSlide = -1;
			var cursorInf = editor.getCursor();

			for (var i in tags) {
				var infoChar = editor.posFromIndex(i);
				if(infoChar.line < cursorInf.line || (infoChar.line == cursorInf.line && infoChar.ch <= cursorInf.ch)) {
					if (tags[i] == true) {
						iLevel++;
						if (iLevel == 1) {
							iCurrentSlide++; // we just got a first level <article>
						}
					}
					else {
						iLevel--;
					}
				} else {
					break;
				}
			}
			return iCurrentSlide;
		}

        // Find the slide with the number passed in parameter and give its position. A {from, to} object will be returned.
		function getSlideInfo(iSlide) {
            var tags = getTagIndexes(editor.getValue(), "article", true);
            var iLevel = 0;
			var iCurrentSlide = -1;
			var result = {from: null, to:null};
			for (var i in tags) {
				if (tags[i] == true) {
					iLevel++;
                    if (iLevel == 1) {
						iCurrentSlide++; // we just got a first level <article>
						if(iCurrentSlide == iSlide) {
							result.from = editor.posFromIndex(i);
						}
					}
				}
				else {
                    iLevel--;
					if(iLevel == 0 && iCurrentSlide == iSlide) {

                        var newVal = szTag.length + 3 + parseInt(i);
                        result.to = editor.posFromIndex(newVal);
						break;
					}
				}
			}
			return result;
		}

        // Check if we have a right selection, that allow us to change the color of the selection.
        function canChangeCurrentColor() {
            if(!cursorIsBetweenTag("span", true)){
                return false;
            }

            var resBeforeText = getTagBeforeStartCursor("span", true);
            if(!resBeforeText) {
                return false;
            }
            var resStyle = getAttributeTag(resBeforeText, "style");
            if(!resStyle) {
                return false;
            }
            return true;
        }

        // Replace the current color of span tag, must be call after the canChangeCurrentColor() method to be sure it works.
        function changeCurrentColor(color) {
            var resBeforeText = getTagBeforeStartCursor("span", true);
            var resStyle = getAttributeTag(resBeforeText, "style");
            setColorTag(resStyle, color);
        }

        // Replace the color in the right place in the {from, to} passed object
        function setColorTag(object, newColor) {
            var szText = editor.getRange(object.from, object.to);
            if(szText && szText.length > 0) {
                var re1 = new RegExp(/([;'"][ ]*color[ ]*:[ ]*)[^;]+[ ]*([;'"])/);
                re1.exec(szText);
                var replacedText = RegExp.leftContext + RegExp.$1 + newColor + RegExp.$2 + RegExp.rightContext;
                var vFrom = object.from;
                var vTo = {line: vFrom.line, ch: vFrom.ch + szText.length};
                editor.replaceRange(replacedText, vFrom, vTo);
            }
        }

        // if the tag in argument is found, a {from, to} object will be returned.
        function getTagBeforeStartCursor(szTag, bWithAttr) {
            var startTag = bWithAttr ? '<' + szTag : '<' + szTag + '>';
            var startPos = editor.getCursor(true);
            var szLineStText = editor.getLine(startPos.line);
            var szBeforeText = szLineStText.substr(0, startPos.ch);
            var pos1 = szBeforeText.lastIndexOf(startTag);
            if(pos1 == -1) {
                return null;
            }
            szBeforeText = szBeforeText.substr(pos1);
            var pos2 = szBeforeText.indexOf('>');
            if(pos2 != szBeforeText.length - 1) {
                return null;
            }
            return {from: {line:startPos.line, ch:pos1}, to: {line:startPos.line, ch:pos1+pos2+1}};

        }

        // check if the selection is between the passed tag in parameter
        function cursorIsBetweenTag(szTag, bWithAttr) {
            var startTag = bWithAttr ? '<' + szTag : '<' + szTag + '>';
            var endTag = '</' + szTag + '>';

            //check if the start tag exists
            if(!getTagBeforeStartCursor(szTag, bWithAttr)) {
                return false;
            }

            //check if the end tag exists
            var endPos = editor.getCursor(false);
            var szLineText = editor.getLine(endPos.line);
            var szNextText = szLineText.substr(endPos.ch);
            if(szNextText.indexOf(endTag) != 0) {
                return false;
            }

            // Now we check if the end tag was not for an other tag
            if(editor.somethingSelected()){
                var selText = editor.getSelection();
                var tags = [];

                var pos = selText.indexOf(startTag);
                while (pos != -1) {
                    tags[pos] = true;
                    pos = selText.indexOf(startTag, pos+1);
                }

                pos = selText.indexOf(endTag);
                while (pos != -1) {
                    tags[pos] = false;
                    pos = selText.indexOf(endTag, pos+1);
                }
                var iLevel = 0;
                for (var i in tags) {
                    if (tags[i] == true) {
                        iLevel++;
                    }
                    else {
                        iLevel--;
                    }
                    if(iLevel < 0) {
                        return false;
                    }
                }
            }
            return true;
        }

        // permit to clean the selection when it begins or finishes in a tag
        function cleanSelection() {
            if(!editor.somethingSelected()) {
                return;
            }
            var selText = editor.getSelection();
            var posStartCursor = editor.getCursor(true);
            var posEndCursor = editor.getCursor(false);
            var newVal;

            //when it begins in a tag
            var pos1 = selText.indexOf("<");
            var pos2 = selText.indexOf(">");
            if (pos2 != -1) {
                if(pos1 == -1 || pos2 < pos1) {
                    newVal = 1 + parseInt(pos2) + editor.indexFromPos(posStartCursor);
                    editor.setSelection(editor.posFromIndex(newVal), posEndCursor);
                    posStartCursor = editor.getCursor(true);
                    selText = editor.getSelection();
                }
            }
            //when it finishes in a tag
            var pos3 = selText.lastIndexOf("<");
            var pos4 = selText.lastIndexOf(">");
            if (pos3 != -1) {
                if(pos4 == -1 || pos4 < pos3) {
                    newVal = parseInt(pos3) + editor.indexFromPos(posStartCursor);
                    editor.setSelection(posStartCursor, editor.posFromIndex(newVal));
                }
            }
        }

        // Try to find the passed attribute in the range of {from, to} object. A {from, to} object will be returned.
        function getAttributeTag(object, attr) {
            var szText = editor.getRange(object.from, object.to);
            if(szText && szText.length > 0) {
                if(szText.lastIndexOf('<') == 0 && szText.indexOf('>') == szText.length - 1) {
                    var re = new RegExp('('+attr+'[ ]*=[ ]*)([\'\"][^\'\"]+[\'\"])');
                    re.exec(szText);
                    var vFrom = {line: object.from.line, ch: object.from.ch+RegExp.leftContext.length+RegExp.$1.length};
                    var vTo = {line: vFrom.line, ch: vFrom.ch + RegExp.$2.length};
                    return {from: vFrom, to: vTo};
                }
            }
            return null;
        }

		$("#toolbar > *[data-tool]").click(function() {
			if ($(this).hasClass('disabled')) {
				return;
			}

			var tool = $(this).data("tool");
			var newSelection = editor.getSelection();
			var endTagLength = null;

			if (tool == "img") {
				var src = prompt("Enter the URL of the image");

				if (!src) return;

				newSelection = '<img src="' + src + '" />';
				endTagLength = 0;
			}
			else if (tool == "a") {
				var href = prompt("Enter the URL of the link");

				if (!href) return;

				var text;
                cleanSelection();

				if (editor.somethingSelected()) {
					text = editor.getSelection();
				}
				else {
					text = prompt("Enter the text of the link");
				}

				if (!text) text = href;

				newSelection = '<a href="' + href + '">' + text + '</a>';
				endTagLength = 0;
				
			}else if(tool == "add"){
                var slide = getSlideInfo(selectedSlide);
                var newSlide =
                editor.replaceRange(currentTemplate,  {line: slide.to.line, ch: slide.to.ch+1}, {line: slide.to.line, ch: slide.to.ch+1});

                editor.focus();
                editor.setCursor({line:slide.to.line+4, ch: 4});

			}else if(tool == "delete"){
				if(confirm("Are you sure you want to delete the current slide?")){
                    var slide = getSlideInfo(selectedSlide);
                    var lineEnd = slide.to.line;
                    var chEnd = slide.to.ch;
                    var lineBegin = slide.from.line;
                    var chBegin = slide.from.ch;



                    while(editor.lineInfo(lineEnd)!=null && editor.lineInfo(lineEnd).text.indexOf("<article") == -1 && lineEnd < editor.lineCount()){
                        lineEnd++;
                    }

                    if(lineEnd == editor.lineCount())
                    {
                        while(editor.lineInfo(lineBegin)!=null && editor.lineInfo(lineBegin).text.indexOf("</article>") == -1 && lineBegin > 0){
                            lineBegin--;
                        }
                        chBegin =  editor.lineInfo(lineBegin).text.indexOf("</article>") + 10;
                    }
                    else if(lineEnd != slide.to.line){
                        chEnd =  editor.lineInfo(lineEnd).text.indexOf("<article");
                    }
					editor.replaceRange("",{line: lineBegin, ch:chBegin}, {line: lineEnd, ch: chEnd});


				}
			}else if (tool == "save") {
				if(fileName != ""){
					saveFile(fileName);
				}else{
					saveAsFile();
				}
			}else if (tool == "saveAs") {
				saveAsFile();
			}else if (tool == "rmFile") {
				removeFile(fileName);
			}
            else if(tool == "prev"){
                if(selectedSlide > 0){
                    var slide = getSlideInfo(selectedSlide-1);
                    previewFrame.contentWindow.prevSlide();
                    var coord = editor.charCoords({line:slide.from.line, ch:slide.from.ch},"local");
                    editor.scrollTo(coord.x, coord.y);
                }
                return;
            }
            else if(tool == "next"){

                if(selectedSlide < totalSlides-1){
                    var slide = getSlideInfo(selectedSlide+1);
                    previewFrame.contentWindow.nextSlide();
                    var coord = editor.charCoords({line:slide.from.line, ch:slide.from.ch},"local");
                    editor.scrollTo(coord.x, coord.y);
                }
                return;
            }
			else {
                cleanSelection();
				newSelection = "<"+tool+">"+editor.getSelection()+"</"+tool+">";
				endTagLength = tool.length+3;
			}

			var hadSomethingSelected = editor.somethingSelected();
			if(hadSomethingSelected) editor.replaceSelection(newSelection);

			if(endTagLength != null && !hadSomethingSelected){
				var pos = editor.getCursor();
				pos = {line: pos.line, ch: pos.ch - endTagLength};
				editor.setCursor(pos);
			}
			
			editor.focus();
		});

		$('#colorpicker').ColorPicker({
			color: '#000000',
			onChange: function (hsb, hex, rgb) {
				//$('#colorSelector div').css('backgroundColor', '#' + hex);
				var newSelection = String(editor.getSelection());
				var tag = "<span";
				if(newSelection.substring(0, tag.length).toLowerCase() == tag){
					var code = newSelection.substring(newSelection.indexOf("#")+1,newSelection.indexOf("#")+7);
					newSelection = newSelection.replace(code, hex);
				}else{
					newSelection = "<span style='color:#"+hex+";'>"+newSelection+"</span>";
				}
                cleanSelection();
                if(canChangeCurrentColor()) {
                    changeCurrentColor("#"+hex);
                } else {
				    editor.replaceSelection(newSelection);
                }
				$('#colorpicker').css({'background-color': '#' + hex});
			}
		});



		function updatePreview() {
			now.transform(editor.getValue(), function(previewHTML) {
				if (previewHTML == null) {
					alert('Error while parsing input');
					return;
				}
				
				var content = previewFrame.contentDocument || previewFrame.contentWindow.document;

				// putting HTML into iframe
				content.open();

				// we need to inject some JS before putting it into the iframe to make the slideshow start at the slide we're currently editing
				// and to make it so that when we navigate slides in the iframe, the browser's location hash changes too
				var js = '<script> \
				curSlide = ' + selectedSlide + '; \
				var oldUpdateHash = updateHash; \
				updateHash = function() { oldUpdateHash(); window.top.location.hash = curSlide + 1; } \
				</script>';

				if ($.browser.mozilla) {
					// updateHash is broken in firefox when put in an iframe with no src
					js = js.replace('oldUpdateHash();', '');
				}
				
				previewHTML = previewHTML.replace('</head>', js + '</head>');

				content.write(previewHTML);

				content.close();
			});
		}
		
		function autoEncodePre(cm, ch){
			var pos = cm.getCursor();
			var tok = cm.getTokenAt(pos);
			var state = tok.state;
			
			var type = state.htmlState ? state.htmlState.type : state.type;

			if (state.htmlState.context.tagName == 'pre') {
				if (ch == '<') {
					cm.replaceSelection('&lt;');
				}else if (ch == '>') {
					cm.replaceSelection('&gt;');
				}
				pos = {line: pos.line, ch: pos.ch + 4};
				cm.setCursor(pos);
				return;			
			}else{
				throw CodeMirror.Pass;
			}
		}

		$(window).trigger('hashchange');
		setSplitAt(splitSize);
		fillFilesCombobox();
		updatePreview();
	});
});
}());
