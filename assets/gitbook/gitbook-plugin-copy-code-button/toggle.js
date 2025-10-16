require(["gitbook", "jquery"], function (gitbook, $) {
    function selectElementText(el) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function getSelectedText() {
        var t = '';
        if (window.getSelection) {
            t = window.getSelection();
        } else if (document.getSelection) {
            t = document.getSelection();
        } else if (document.selection) {
            t = document.selection.createRange().text;
        }
        return t;
    }

    function copyToClipboard(text) {
        if (window.clipboardData && window.clipboardData.setData) {
            // IE specific code path to prevent textarea being shown while dialog is visible.
            return clipboardData.setData("Text", text);

        } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
            var textarea = document.createElement("textarea");
            textarea.textContent = text;
            textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
            document.body.appendChild(textarea);
            textarea.select();
            try {
                return document.execCommand("copy");  // Security exception may be thrown by some browsers.
            } catch (ex) {
                console.warn("Copy to clipboard failed.", ex);
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    function expand(chapter) {
        chapter.show();
        if (chapter.parent().attr('class') != 'summary'
            && chapter.parent().attr('class') != 'book-summary'
            && chapter.length != 0
        ) {
            expand(chapter.parent());
        }
    }

    gitbook.events.bind("page.change", function () {
        $("pre").each(function () {
            var $pre = $(this);
            if ($pre.parent().hasClass("code-wrapper")) {
                return;
            }
            $pre.wrap('<div class="code-wrapper" style="position: relative;"></div>');

            $pre.css("position", "relative");

            var copyIcon = "<div class='copy-code-button'><span class=\"material-symbols-rounded\" style=\"line-height: normal\">content_copy</span></div>";
            var copiedIcon = "<div class='copy-code-button'><span class=\"material-symbols-rounded\" style=\"line-height: normal\">check</span></div>";
            var $copyCodeButton = $("<span class='section.norma'></span>");//</span>
            $copyCodeButton.html(copyIcon);
            $copyCodeButton.css({ "position": "absolute", "top": "5px", "right": "5px"});
            $copyCodeButton.click(function () {
                var $codeContainer = $(this).siblings("pre").children("code");
                if ($codeContainer) {
                    selectElementText($codeContainer.get(0));
                    var selectedText = getSelectedText();

                    var buttonNewText = "";
                    if (copyToClipboard(selectedText) == true) {
                        buttonNewText = copiedIcon;
                        selectElementText($codeContainer.get(0));
                    } else {
                        buttonNewText = "Unable to copy";
                        selectElementText($codeContainer.get(0));
                    }

                    $(this).html(buttonNewText);
                    var that = this;
                    setTimeout(function () {
                        $(that).html(copyIcon);
                    }, 2000);
                }
            });

            $pre.parent().append($copyCodeButton);
        });
    });
});
