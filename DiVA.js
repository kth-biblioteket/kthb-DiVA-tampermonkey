// ==UserScript==
// @name     DiVA
// @version      1.0.15
// @description  En Apa för att hjälpa till med DiVA-arbetet på KTH Biblioteket
// @author Thomas Lind
// @updateURL    https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf*
// @match    https://kth.diva-portal.org/dream/import/importForm.jsf*
// @match    https://kth.diva-portal.org/dream/publish/publishForm.jsf*
// @match    https://kth.diva-portal.org/dream/review/reviewForm.jsf*
// @match    https://kth.diva-portal.org/dream/info.jsf*
// @require  https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require  https://cdn.jsdelivr.net/npm/js-cookie@rc/dist/js.cookie.min.js
// @require  https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js
// @grant    GM_xmlhttpRequest
// @grant    GM_addStyle
// @connect  apps.lib.kth.se
// @connect  lib.kth.se
// @connect  pub.orcid.org
// @connect  localhost
// @connect  api.elsevier.com
// @connect  google.com
// @connect  kth.diva-portal.org
// @connect  ws.isiknowledge.com
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */
var ldapapikey;
var orcidapikey;
var letaanstalldaapikey;
var scopusapikey;

/**
 * Funktion för att sätta apinycklar
 *
 * @param {object} keys
 */
function setapikeys(keys) {
    ldapapikey = keys.apikeys.ldap;
    orcidapikey = keys.apikeys.orcid;
    letaanstalldaapikey = keys.apikeys.letaanstallda;
    scopusapikey = keys.apikeys.scopus;
}

/**
 * Funktion som verifierar användarens JWT-token
 *
 * @param {string} token
 */
function verifytoken(token) {
    $('#monkeylogin').fadeOut(300);
    $('#username').val('');
    $('#password').val('');
    if (token) {
        $.ajax({
            type: 'POST',
            url: 'https://lib.kth.se/ldap/api/v1/divamonkey',
            dataType: 'JSON',
            headers: {
                'x-access-token': token
            },
            success: function(response, textStatus, xhr) {
                //om användaren inte tillhör bibblan
                if (xhr.status == 201) {
                    alert('not authorized');
                    $('#monkeylogin').css("display", "block");
                    return;
                };
                //Om behörig bibblananvändare
                if (response.apikeys) {
                    //Spara token i en cookie (som gäller lång hur tid?)
                    Cookies.set('token', response.token)
                    setapikeys(response)
                    init();
                } else {
                    Cookies.remove('token')
                    $('#monkeylogin').css("display", "block");
                }
            },
            error:
            //401 Unauthorized
            function(response, textStatus, xhr) {
                alert("Unauthorized")
                Cookies.remove('token')
                $('#monkeylogin').css("display", "block");
            }
        });
    } else {
        Cookies.remove('token')
        $('#monkeylogin').css("display", "block");
    }
}

/**
 *
 * Funktion som skapar ett loginformulär
 *
 */
function monkeylogin() {
    var html =
        '<div id="monkeylogin">' +
            '<form id="monkeyloginform">' +
                '<div>Logga in till Apan</div>' +
                '<div class = "flexbox column rowpadding">' +
                    '<input class="rowmargin" id="username" name="username" placeholder="kthid" type="text">' +
                    '<input class="rowmargin" id="password" name="password" placeholder="password" type="password">' +
                '</div>' +
            '</form>' +
            '<button id="login">Login</button>' +
        '</div>'
    $('body').append(html);

    var loginButton = $('#login');
    loginButton.click(function() {
        var username = $('#username').val() + "@ug.kth.se";
        var password = $('#password').val();
        $.ajax({
            type: 'POST',
            url: 'https://lib.kth.se/ldap/api/v1/login',
            dataType: 'JSON',
            data: {
                username: username,
                password: password
            },
            success: function(response) {
                verifytoken(response.token);
            },
            error: function(response, textStatus, xhr) {
                alert("Bad credentials, please try again");
            }
        });
    });
}

/**
 * Sorterar en array(json response)
 * 
 * @param {*} array 
 * @param  {...any} attrs 
 * 
 */
function sortByAttribute(array, ...attrs) {
    let predicates = attrs.map(pred => {
      let descending = pred.charAt(0) === '-' ? -1 : 1;
      pred = pred.replace(/^-/, '');
      return {
        getter: o => o[pred],
        descend: descending
      };
    });
    return array.map(item => {
      return {
        src: item,
        compareValues: predicates.map(predicate => predicate.getter(item))
      };
    })
    .sort((o1, o2) => {
      let i = -1, result = 0;
      while (++i < predicates.length) {
        if (o1.compareValues[i] < o2.compareValues[i]) result = -1;
        if (o1.compareValues[i] > o2.compareValues[i]) result = 1;
        if (result *= predicates[i].descend) break;
      }
      return result;
    })
    .map(item => item.src);
}

/**
 * Funktion som hanterar fel från api:er
 *
 * @param {object} response
 */
function api_error(response) {
    console.error(`Error ${response.status}!  ${response.statusText}`);
    $("#monkeyresultswrapper i").css("display", "none");
    $('#monkeyresults').html('<p>' + response.statusText + '</p>');
}

/**
 * Funktion för att anropa DiVA och hämta information via "search"
 *
 * @param {string} titleAll
 * @param {string} format (csl_json=json, mods=xml)
 */
function getDiVA(titleAll, format) {
    var diva_url = 'https://kth.diva-portal.org/smash/export.jsf?format=' + format + '&addFilename=true&aq=[[{"titleAll":"' +
        titleAll + '"}]]&aqe=[]&aq2=[[]]&onlyFullText=false&noOfRows=50&sortOrder=title_sort_asc&sortOrder2=title_sort_asc';
    $.ajax({
        type: 'GET',
        url: diva_url,
        success: function(response, textStatus, xhr) {
            var results = false;
            var html = '<div id="popup"><div id="close">X</div><h2>Information från DiVA, Söktext: ' + titleAll + '</h2>';
            if (xhr.getResponseHeader("content-type").indexOf('xml')) {
                if ($(response).find('mods').length > 0) {
                    results = true;
                    $(response).find('mods').each(function(i, j) {
                        html += '<p>Status: ' + $(j).find('note[type="publicationStatus"]').text() + '</p>' +
                            '<p>Note: ' + $(j).find('note').text() + '</p>' +
                            '</br>'
                    });
                }
            }
            if (xhr.getResponseHeader("content-type").indexOf('json')) {
                if (response.length > 0) {
                    results = true;
                    $.each(response, function(key, value) {
                        html += '<p>Status: ' + response[key].status + '</p>' +
                            '<p>ID: ' + response[key].id + '</p>' +
                            '<p>Note: ' + response[key].note + '</p>' +
                            '<p>DOI: ' + response[key].DOI + '</p>' +
                            '<p>ScopusId: ' + response[key].ScopusId + '</p>' +
                            '<p>Created: ' + response[key].created[0].raw + '</p>' +
                            '<p>Updated: ' + response[key].updated[0].raw + '</p>' +
                            '</br>'
                    });
                };
            }
            if (!results) {
                alert("Hittade inget i DiVA på: " + titleAll);
                return;
            }
            html += '</div>'
            $('#ldapoverlay').html(html);
            $('#ldapoverlay').css("display", "block");

            //Stängknapp till overlay
            var closeButton = $('#close');
            closeButton.click(function() {
                $('#ldapoverlay').css("display", "none");
                $('#ldapoverlay').html('');
            });
        },
        error:
        //TODO felhantering
        function(response, textStatus, xhr) {
            console.log(xhr);
        }
    });
}

/**
 * Funktion för att anropa DBLP och hämta information via DOI
 *
 * @param {string} doi
 */
function getDblp(doi) {
    $.ajax({
        type: 'GET',
        url: 'https://dblp.uni-trier.de/doi/xml/' + doi,
        dataType: 'xml',
        success: function(response, textStatus, xhr) {
            if ($(response).find("crossref").text()) {
                $.ajax({
                    type: 'GET',
                    url: 'https://dblp.uni-trier.de/rec/xml/' + $(response).find("crossref").text(),
                    dataType: 'xml',
                    success: function(response, textStatus, xhr) {
                        var html = '<div id="popup"><div id="close">X</div><h2>Information från dblp, DOI: ' + doi + '</h2>';
                        html += "<p>" + $(response).find("title").text() + "</p>" +
                            "<p>Series: " + $(response).find("series").text() + "</p>" +
                            "<p>Volume: " + $(response).find("volume").text() + "</p>" +
                            '</div>'

                        $('#ldapoverlay').html(html);
                        $('#ldapoverlay').css("display", "block");

                        //Stängknapp till overlay
                        var closeButton = $('#close');
                        closeButton.click(function() {
                            $('#ldapoverlay').css("display", "none");
                            $('#ldapoverlay').html('');
                        });
                    },
                    error:
                    //TODO felhantering
                    function(response, textStatus, xhr) {
                        console.log(xhr);
                    }
                });
            } else {
                alert("Hittade inget i dblp på: " + doi);
            }
        },
        error:
        //TODO felhantering
        function(response, textStatus, xhr) {
            console.log(xhr);
        }
    });
}

/**
 * Funktion för att anrop WoS och hämta information via DOI
 *
 * @param {string} doi
 */
function getClarivate(doi) {
    $.ajax({
        type: 'GET',
        url: 'https://apps.lib.kth.se/alma/wos/wosapi_b.php?source=wos&doi=' + doi,
        dataType: 'json',
        beforeSend: function(){
            $("#clarivateButtonjq i").css("display", "inline-block");
        },
        success: function(response, textStatus, xhr) {
            console.log(response)
            var html = '<div id="popup"><div id="close">X</div><h2>Information från Clarivate</h2>';
            if (response.status == 201) {
                html += "<p>Hittade inget i WoS</p>";
            } else {
                //hitta ISIid
                html += "<p>" + "<i>Clarivate</i><br /><br />" +
                    "DOI: " + response.wos.doi + "<br />" +
                    "PMID: " + response.wos.pmid + "<br />" +
                    "UT: " + response.wos.ut + "<br /><br />" +
                    "</p>"
                $("div.diva2addtextchoicecol:contains('ISI')").parent().find('input').val(response.wos.ut); // skriv in värdet för ISI/UT i fältet för ISI
                $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(response.wos.pmid); // skriv in värdet för PMID i fältet för PMID
            };
            html += '</div>'
            $('#ldapoverlay').html(html);
            $('#ldapoverlay').css("display", "block");

            //Stängknapp till overlay
            var closeButton = $('#close');
            closeButton.click(function() {
                $('#ldapoverlay').css("display", "none");
                $('#ldapoverlay').html('');
            });
        },
        complete: function(){
            $("#clarivateButtonjq i").css("display", "none");
        },
        error:
        //TODO felhantering
        function(response, textStatus, xhr) {
            console.log(xhr);
        }
    });
}

/**
 * Funktion för att initiera Apan
 *
 */
function init() {
    //Skapa en knapp överst
    $('#DiVAButtonjq').remove();
    var DiVAButtonjq = $('<button id="DiVAButtonjq" type="button">Sök i DiVA</button>');
    //bind en clickfunktion som anropar "DiVA-API" med titelfältet
    var $maintitleiframe;
    $maintitleiframe = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first();
    DiVAButtonjq.on("click", function() {
        getDiVA($maintitleiframe.contents().find("body").html(), 'csl_json');
    })
    $(".diva2editmainer").before(DiVAButtonjq)
    $(".diva2impmainer").before(DiVAButtonjq)
    $(".diva2reviewmainer").before(DiVAButtonjq)
    $(".diva2pubmainer").before(DiVAButtonjq)

    ///////////////////////////////////////////////////////////
    //
    // Skapa en knapp vid titelfältet för att splitta 
    // titel i huvud- och undertitel vid kolon :
    //
    ///////////////////////////////////////////////////////////
    var $subtitleiframe = $("div.diva2addtextchoicecol:contains('Undertitel:') , div.diva2addtextchoicecol:contains('Subtitle:')").next().find('iframe').first();
    $('#titlesplitButtonjq').remove();
    var titlesplitButtonjq = $('<button id="titlesplitButtonjq" type="button">Split : </button>');
    titlesplitButtonjq.on("click", function() {
        var maintitle = $maintitleiframe.contents().find("body").html();
        var subtitle = $subtitleiframe.contents().find("body").html();
        var changedmaintitle = maintitle.split(":")[0];
        subtitle = maintitle.split(":")[1];
        $maintitleiframe.contents().find("body").html(changedmaintitle);
        $subtitleiframe.contents().find("body").html(subtitle);
    })
    // extremt fult sätt att skilja 'titel' från 'alternativ titel' eftersom 'alternativ titel' innehåller 'titel'
    var s_title = $("div.diva2addtextchoicebr:contains('Titel'), div.diva2addtextchoicebr:contains('Title')").not($("div.diva2addtextchoicebr:contains('Alternativ'), div.diva2addtextchoicebr:contains('Alternative')"))
    $(s_title).before(titlesplitButtonjq)

    ///////////////////////////////////////////////////////////
    //
    // Skapa en knapp vid titelfältet för att ändra versaler 
    // till gemener förutom första bokstaven
    //
    ///////////////////////////////////////////////////////////
    $('#caseButtonjq').remove();
    var caseButtonjq = $('<button id="caseButtonjq" type="button">A->a</button>');
    //bind en clickfunktion
    caseButtonjq.on("click", function() {
        var maintitle = $maintitleiframe.contents().find("body").html();
        var subtitle = $subtitleiframe.contents().find("body").html();
        var changedmaintitle = maintitle.charAt(0) + maintitle.substring(1).toLowerCase();
        var changedsubtitle = subtitle.charAt(0) + subtitle.substring(1).toLowerCase();
        $maintitleiframe.contents().find("body").html(changedmaintitle);
        $subtitleiframe.contents().find("body").html(changedsubtitle);
    })
    // extremt fult sätt att skilja 'titel' från 'alternativ titel' eftersom 'alternativ titel' innehåller 'titel'
    var c_title = $("div.diva2addtextchoicebr:contains('Titel'), div.diva2addtextchoicebr:contains('Title')").not($("div.diva2addtextchoicebr:contains('Alternativ'), div.diva2addtextchoicebr:contains('Alternative')"));
    $(c_title).before(caseButtonjq)

    ///////////////////////////////////////////////////////////
    //
    // Skapa en knapp vid titelfältet för proceedings, 
    // att splitta titel i huvud- och undertitel vid kolon :
    //
    ///////////////////////////////////////////////////////////
    var $procmaintitleiframe = $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding') , div.diva2addtextchoice2:contains('Part of proceedings')").parent().next().next().find('iframe').first();
    var $procsubtitleiframe = $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding') , div.diva2addtextchoice2:contains('Part of proceedings')").parent().next().next().next().next().find('iframe').first();
    $('#proctitlesplitButtonjq').remove();
    var proctitlesplitButtonjq = $('<button id="proctitlesplitButtonjq" type="button">Split : </button>');
    proctitlesplitButtonjq.on("click", function() {
        var procmaintitle = $procmaintitleiframe.contents().find("body").html();
        var procsubtitle = $procsubtitleiframe.contents().find("body").html();
        var changedprocmaintitle = procmaintitle.split(":")[0];
        procsubtitle = procmaintitle.split(":")[1];
        $procmaintitleiframe.contents().find("body").html(changedprocmaintitle);
        $procsubtitleiframe.contents().find("body").html(procsubtitle);
    })
    $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding'), div.diva2addtextchoice2:contains('Part of proceedings')").parent().before(proctitlesplitButtonjq)
    
    ///////////////////////////////////////////////////////////
    //
    // Skapa en knapp vid titelfältet för proceedings, 
    // att ändra versaler till gemener förutom första bokstaven
    //
    ///////////////////////////////////////////////////////////
    $('#proctitlecaseButtonjq').remove();
    var proctitlecaseButtonjq = $('<button id="proctitlecaseButtonjq" type="button">A->a</button>');
    proctitlecaseButtonjq.on("click", function() {
        var procmaintitle = $procmaintitleiframe.contents().find("body").html();
        var procsubtitle = $procsubtitleiframe.contents().find("body").html();   
        var changedprocmaintitle = procmaintitle.charAt(0) + procmaintitle.substring(1).toLowerCase();
        var changedprocsubtitle = procsubtitle.charAt(0) + procsubtitle.substring(1).toLowerCase();
        $procmaintitleiframe.contents().find("body").html(changedprocmaintitle);
        $procsubtitleiframe.contents().find("body").html(changedprocsubtitle);
    })
    $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding'), div.diva2addtextchoice2:contains('Part of proceedings')").parent().before(proctitlecaseButtonjq)

    ///////////////////////////////////////////////////////////
    //
    // Skapa en knapp vid titelfältet för böcker, 
    // att splitta titel i huvud- och undertitel vid kolon :
    //
    ///////////////////////////////////////////////////////////
    var $bookmaintitleiframe = $("div.diva2addtextchoice2:contains('Ingår i bok') , div.diva2addtextchoice2:contains('Part of book')").parent().next().next().find('iframe').first();
    var $booksubtitleiframe = $("div.diva2addtextchoice2:contains('Ingår i bok') , div.diva2addtextchoice2:contains('Part of book')").parent().next().next().next().next().find('iframe').first();
    $('#booktitlesplitButtonjq').remove();
    var booktitlesplitButtonjq = $('<button id="booktitlesplitButtonjq" type="button">Split : </button>');
    booktitlesplitButtonjq.on("click", function() {
        var bookmaintitle = $bookmaintitleiframe.contents().find("body").html();
        var booksubtitle = $booksubtitleiframe.contents().find("body").html();
        var changedbookmaintitle = bookmaintitle.split(":")[0];
        booksubtitle = bookmaintitle.split(":")[1];
        $bookmaintitleiframe.contents().find("body").html(changedbookmaintitle);
        $booksubtitleiframe.contents().find("body").html(booksubtitle);
    })
    $("div.diva2addtextchoice2:contains('Ingår i bok'), div.diva2addtextchoice2:contains('Part of book')").parent().before(booktitlesplitButtonjq)

    ///////////////////////////////////////////////////////////
    //
    //Skapa en knapp vid titelfältet för böcker, att ändra versaler till gemener förutom första bokstaven
    //
    ///////////////////////////////////////////////////////////
    $('#booktitlecaseButtonjq').remove();
    var booktitlecaseButtonjq = $('<button id="booktitlecaseButtonjq" type="button">A->a</button>');
    booktitlecaseButtonjq.on("click", function() {
        var bookmaintitle = $bookmaintitleiframe.contents().find("body").html();
        var booksubtitle = $booksubtitleiframe.contents().find("body").html();
        var changedbookmaintitle = bookmaintitle.charAt(0) + bookmaintitle.substring(1).toLowerCase();
        var changedbooksubtitle = booksubtitle.charAt(0) + booksubtitle.substring(1).toLowerCase();
        $bookmaintitleiframe.contents().find("body").html(changedbookmaintitle);
        $booksubtitleiframe.contents().find("body").html(changedbooksubtitle);
    })
    $("div.diva2addtextchoice2:contains('Ingår i bok'), div.diva2addtextchoice2:contains('Part of book')").parent().before(booktitlecaseButtonjq)

    ///////////////////////////////////////////////////////////
    //
    // Skapa en knapp vid alternativtitelfältet, 
    // att splitta titel i huvud- och undertitel vid kolon :
    //
    ///////////////////////////////////////////////////////////
    var $altmaintitleiframe = $("div.diva2addtextchoice2:contains('Alternativ') , div.diva2addtextchoice2:contains('Alternative')").parent().next().find('iframe').first();
    var $altsubtitleiframe = $("div.diva2addtextchoice2:contains('Alternativ') , div.diva2addtextchoice2:contains('Alternative')").parent().next().next().next().find('iframe').first();
    $('#alttitlesplitButtonjq').remove();
    var alttitlesplitButtonjq = $('<button id="alttitlesplitButtonjq" type="button">Split : </button>');
    alttitlesplitButtonjq.on("click", function() {
        var altmaintitle = $altmaintitleiframe.contents().find("body").html();
        var altsubtitle = $altsubtitleiframe.contents().find("body").html();
        var changedaltmaintitle = altmaintitle.split(":")[0];
        altsubtitle = altmaintitle.split(":")[1];
        $altmaintitleiframe.contents().find("body").html(changedaltmaintitle);
        $altsubtitleiframe.contents().find("body").html(altsubtitle);
    })
    $("div.diva2addtextchoice2:contains('Alternativ'), div.diva2addtextchoice2:contains('Alternative')").parent().before(alttitlesplitButtonjq)

    ///////////////////////////////////////////////////////////////
    //
    // Skapa en knapp vid alternativtitelfältet, 
    // att ändra versaler till gemener förutom första bokstaven
    //
    ///////////////////////////////////////////////////////////////
    $('#alttitlecaseButtonjq').remove();
    var alttitlecaseButtonjq = $('<button id="alttitlecaseButtonjq" type="button">A->a</button>');
    alttitlecaseButtonjq.on("click", function() {
        var altmaintitle = $altmaintitleiframe.contents().find("body").html();
        var altsubtitle = $altsubtitleiframe.contents().find("body").html();
        var changedaltmaintitle = altmaintitle.charAt(0) + altmaintitle.substring(1).toLowerCase();
        var changedaltsubtitle = altsubtitle.charAt(0) + altsubtitle.substring(1).toLowerCase();
        $altmaintitleiframe.contents().find("body").html(changedaltmaintitle);
        $altsubtitleiframe.contents().find("body").html(changedaltsubtitle);
    })
    $("div.diva2addtextchoice2:contains('Alternativ'), div.diva2addtextchoice2:contains('Alternative')").parent().before(alttitlecaseButtonjq)

    ////////////////////////////////////////
    //
    // WoS och "Clarivate" knappar vid ISI
    //
    ////////////////////////////////////////
    $('#WoSButtonjq').remove();
    var WoSButtonjq = $('<button id="WoSButtonjq" type="button">WoS</button>');
    WoSButtonjq.on("click", function() {
        var url = "https://focus.lib.kth.se/login?url=https://ws.isiknowledge.com/cps/openurl/service?url_ver=Z39.88-2004&req_id=mailto%3Apublicering%40kth.se&&rft_id=info%3Adoi%2F" +
            $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val() +
            "";
        window.open(url, '_blank'); // sök på DOI i WoS och öppna ett nytt fönster
    })
    $("div.diva2addtextchoicecol:contains('ISI')").before(WoSButtonjq)

    $('#clarivateButtonjq').remove();
    var clarivateButtonjq = $('<button id="clarivateButtonjq" type="button" class="buttonload"><i class="fa fa-spinner fa-spin"></i>Clarivate</button>');
    clarivateButtonjq.on("click", function() {
        getClarivate($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
    })
    $("div.diva2addtextchoicecol:contains('ISI')").before(clarivateButtonjq)

    ////////////////////////////////////
    //
    // Scopus knapp vid "Scopus-fältet"
    //
    ////////////////////////////////////
    $('#scopusButtonjq').remove();
    var scopusButtonjq = $('<button id="scopusButtonjq" type="button">Scopus</button>');
    scopusButtonjq.on("click", function() {
        getScopus($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
    })
    $("div.diva2addtextchoicecol:contains('ScopusID')").before(scopusButtonjq)

    //////////////////////////////////////////////////
    //
    //Knapp för dblp vid konferensfältet
    //
    //////////////////////////////////////////////////
    $('#dblpButtonjq').remove();
    var dblpButtonjq = $('<button id="dblpButtonjq" type="button">dblp</button>');
    //bind en clickfunktion som anropar API med värdet i DOI-fältet
    dblpButtonjq.on("click", function() {
        getDblp($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
    })
    $("div.diva2addtextchoicecol:contains('Konferens') , div.diva2addtextchoicecol:contains('Conference') ").after(dblpButtonjq);

    /////////////////////////////////////////////////////
    //
    //Knapp och länk till hjälpsida i Confluence
    //
    /////////////////////////////////////////////////////
    $('#helpButtonjq').remove();
    var helpButtonjq = $('<button id="helpButtonjq" type="button">Hjälp</button>');
    //bind en clickfunktion öppnar en hjälpsida
    helpButtonjq.on("click", function() {
        var url = "https://confluence.sys.kth.se/confluence/pages/viewpage.action?pageId=74259261"
        window.open(url, '_blank'); // öppna hjälpsida i ett nytt fönster
    })
    $(".diva2editmainer").before(helpButtonjq) // hjälpknapp längst upp på sidan
    $(".diva2impmainer").before(helpButtonjq)
    $(".diva2reviewmainer").before(helpButtonjq)
    $(".diva2pubmainer").before(helpButtonjq)

    ///////////////////////////////////////////////////////////////////////////////////////////////
    //
    //Knapp och länk till extern sökning i KTH webb-DiVA för att se eventuella dubbletter
    //
    ///////////////////////////////////////////////////////////////////////////////////////////////
    $('#dubblettButtonjq').remove();
    var dubblettButtonjq = $('<button id="dubblettButtonjq" type="button">Dubblett?</button>');
    //bind en clickfunktion som anropar DiVA KTH:s webbgränssnitt och söker på titel
    dubblettButtonjq.on("click", function() {
        var url = "https://kth.diva-portal.org/smash/resultList.jsf?dswid=-4067&language=en&searchType=RESEARCH&query=&af=%5B%5D&aq=%5B%5B%7B%22titleAll%22%3A%22" +
            $("div.diva2addtextchoicebr:contains('Title'), div.diva2addtextchoicebr:contains('Titel')").parent().find('textarea').eq(0).val() +
            "%22%7D%5D%5D&aq2=%5B%5B%5D%5D&aqe=%5B%5D&noOfRimportForm:j_id758ows=50&sortOrder=author_sort_asc&sortOrder2=title_sort_asc&onlyFullText=false&sf=all"
        window.open(url, '_blank'); // sök i DiVA webb på titel, öppna i ett nytt fönster
    })
    $(".diva2editmainer").before(dubblettButtonjq) // dubblettknapp längst upp på sidan
    $(".diva2impmainer").before(dubblettButtonjq)
    $(".diva2reviewmainer").before(dubblettButtonjq)
    $(".diva2pubmainer").before(dubblettButtonjq)

    /////////////////////////////////
    //
    //QC och X + QC
    //
    /////////////////////////////////
    $('#qcButton').remove();
    var qcButton = $('<button id="qcButton" type="button">QC</button>');
    qcButton.on("click", function() {
        var $iframe = $('#' + diva_id + '\\:notes_ifr');
        $iframe.ready(function() {
            $iframe.contents().find("body p").html($iframe.contents().find("body p").html() + QC);
        });
    })
    $('#' + diva_id + '\\:notes').after(qcButton)

    $('#qcclearButton').remove();
    var qcclearButton = $('<button id="qcclearButton" type="button">X + QC</button>');
    qcclearButton.on("click", function() {
        var $iframe = $('#' + diva_id + '\\:notes_ifr');
        $iframe.ready(function() {
            $iframe.contents().find("body p").html($iframe.contents().find("body p").html(""));
            $iframe.contents().find("body p").html($iframe.contents().find("body p").html()+ QC);
        });
    })
    $('#' + diva_id + '\\:notes').after(qcclearButton)


    ///////////////////////////////////////////////////////////////////////////////////
    //
    //Funktion för att skapa en knapp vid "Annan organisation" för varje författare, 
    //för att sedan kunna radera detta fält när vi kopplat en KTH-person
    //
    ///////////////////////////////////////////////////////////////////////////////////
    var otherorg = $('#' + diva_id + '\\:authorSerie');
    var j = 0;
    $(otherorg).find("div.diva2addtextchoicecol:contains('Annan organisation') , div.diva2addtextchoicecol:contains('Other organisation')").each(function() {
        var thiz = this;
        //CLEAR ORG
        var clearorgButtonjq = $('<button id="clearorgButtonjq' + j + '" type="button">X</button>');
        //bind en clickfunktion som skall rensa fältet för "Annan organisation"
        clearorgButtonjq.on("click", function() {
            $(thiz).next().find('input').val("");
        })
        $(this).parent().after(clearorgButtonjq);
        j++;
    });

    //////////////////////////////////////////////////////////////////////////
    //
    //Knappar till LDAP, Leta KTH anställda, KTH Intra, Google och ORCiD
    //
    //////////////////////////////////////////////////////////////////////////
    var authors = $('#' + diva_id + '\\:authorSerie');
    var i = 0;
    $(authors).find('.diva2addtextarea').each(function() {
        var thiz = this;

        //LDAP/UG
        var ldapButtonjq = $('<button id="ldapButtonjq' + i + '" type="button">LDAP-info</button>');
        ldapButtonjq.on("click", function() {
            getLDAP($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
        })
        $(this).before(ldapButtonjq)

        //Leta KTH-anställda
        var letaButtonjq = $('<button id="letaButtonjq' + i + '" type="button">Leta anställda</button>');
        letaButtonjq.on("click", function() {
            getLeta($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
        })
        $(this).before(letaButtonjq)

        //Sök i ORCiD
        var orcidButtonjq = $('<button id="orcidButtonjq' + i + '" type="button">Sök ORCiD</button>');
        orcidButtonjq.on("click", function() {
            getOrcid($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
        })
        $(this).before(orcidButtonjq);

        //KTH Intranät förnamn efternamn
        var kthintraButtonjq = $('<button id="kthintraButtonjq' + i + '" type="button">KTH Intra</button>');
        kthintraButtonjq.on("click", function() {
            var url = "https://www.kth.se/search?q=" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "%20" +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                "&urlFilter=https://intra.kth.se&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
            var newurl = url.replace("$$$", "") // ta bort eventuella $$$ från efternamnen före sökning
            var newurl2 = newurl.replace(/[A-Z]\./g, "") // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i KTH Intra
            console.log(newurl2);
            window.open(newurl2, '_blank'); // sök på förnamn efternamn på KTH Intranät
        })
        $(this).before(kthintraButtonjq)

        //Google.com förnamn + efternamn + KTH
        var googleButtonjq = $('<button id="googleButtonjq' + i + '" type="button">Google</button>');
        googleButtonjq.on("click", function() {
            var url = "https://www.google.com/search?q=KTH+" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "+" +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            var newurl = url.replace("$$$", "") // ta bort eventuella $$$ från efternamnen före sökning
            window.open(newurl, '_blank'); // sök på förnamn efternamn + KTH i google
        })
        $(this).before(googleButtonjq)

        i++;
    });

    /////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Hämtar diverse automatiskt när posten öppnas - det Anders kallar headless
    //
    // T ex från Scopus, WoS
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////
    getScopus($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
}

function getOrcid(fnamn, enamn) {
    $("#monkeyresultswrapper i").css("display", "inline-block");
    $("#monkeyresults").html("Apan pratar med ORCiD...");
    var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
    var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning

    var url = "https://lib.kth.se/orcid/api/v1/orcid/" + enamn2 + "/" + fnamn2 + "/?token=" + orcidapikey;
    axios.get(url)
        .then(function (response) {
            if (response.status != 200 && response.status != 201) {
                api_error(response);
                return;
            }
            var html = '<div><h2>Information från ORCiD</h2>';
            if (response.data) {
        
                var json = response.data
                if (response.status == 201) {
                    html += "<p>Inga användare hittades</p>";
                } else {                            
                    $.each(json, function(key, value) {
                        html += '<div class="ldapusers flexbox column" style="padding-bottom: 5px;padding-top: 5px;border-bottom: 1px solid">';
                        html += '<div>' + 
                                    '<span>Namn: </span>' + 
                                    '<span>' + 
                                        '<a target="_new" href="' + json[key]['orcid-identifier'].uri + '">' + 
                                            json[key].person.name['family-name'].value + " " + json[key].person.name['given-names'].value + 
                                        '</a>' +
                                    '</span>' +
                                '</div>'
                        if (json[key]["activities-summary"].employments["affiliation-group"].length > 0) {
                            $.each(json[key]["activities-summary"].employments["affiliation-group"], function(empkey, empvalue) {
                                html += '<div>' + 
                                            '<span>Org: </span>' + 
                                            '<span>' + 
                                                json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"].organization.name +
                                            '</span>' + 
                                        '</div>'
                                if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"]) {
                                    if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].year) {
                                        html += '<div>' + 
                                                    '<span>Year: </span>' + 
                                                    '<span>' + 
                                                        json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].year.value +
                                                    '</span>' + 
                                                '</div>'
                                    }
                                    if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].month) {
                                        html += '<div>' + 
                                                    '<span>Year: </span>' + 
                                                    '<span>' + 
                                                        json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].month.value +
                                                    '</span>' + 
                                                '</div>'
                                    }
                                    if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].day) {
                                        html += '<div>' + 
                                                    '<span>Year: </span>' + 
                                                    '<span>' + 
                                                        json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].day.value +
                                                    '</span>' + 
                                                '</div>'
                                    }
                                }
                            })
                        }
                        html += '</div>'
                    });
                }
            }
            html += '</div>'
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyresults').html(html);
        })
        .catch(function (error) {
            console.log(error);
        })
        .then(function () {
        });
}

function getLDAP(fnamn, enamn) {
    $("#monkeyresultswrapper i").css("display", "inline-block");
    $("#monkeyresults").html("Apan pratar med LDAP...");
    var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
    var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
    var url = "https://lib.kth.se/ldap/api/v1/users/" +
                fnamn2 +
                "* " +
                enamn2 +
                " *" +
                "?token=" + ldapapikey;
    axios.get(url)
        .then(function (response) {
            if (response.status != 200 && response.status != 201) {
                api_error(response);
                return;
            }
        
            var html = '<div><h2>Information från KTH UG(LDAP)</h2>';
        
            if (response.data) {
                var json = response.data
                if (response.status == 201) {
                    html += "<p>Inga användare hittades</p>";
                } else {
                    //gå igenom alla users och lägg till i html
                    //Sortering
                    json.ugusers = sortByAttribute(json.ugusers, 'sn', 'givenName')
                    $.each(json.ugusers, function(key, value) {
                        html += '<div class="ldapusers flexbox column" style="padding-bottom: 5px;padding-top: 5px;border-bottom: 1px solid">';
                        html += "<div><span>Efternamn: </span><span>" + json.ugusers[key].sn + "</span></div>" +
                        "<div><span>Förnamn: </span><span>" + json.ugusers[key].givenName + "</span></div>" +
                        "<div><span>Kthid: </span><span>" + json.ugusers[key].ugKthid + "</span></div>" +
                        "<div><span>Titel: </span><span>" + json.ugusers[key].title + "</span></div>" +
                        "<div><span>Skola/org: </span><span>" + json.ugusers[key].kthPAGroupMembership + "</span></div>"
                        html += '</div>';
                    });
                    
                }
            }
            
            html += '</div>'
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyresults').html(html);
        })
        .catch(function (error) {
            console.log(error);
        })
        .then(function () {
        });
}

function getLeta(fnamn, enamn) {
    $("#monkeyresultswrapper i").css("display", "inline-block");
    $("#monkeyresults").html("Apan pratar med Leta anställda...");
    var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
    var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
    var url = "https://apps-ref.lib.kth.se/webservices/letaanstallda/api/v1/users?fname=" +
                fnamn2 +
                "%&ename=" +
                enamn2 +
                "%" +
                "&api_key=" + letaanstalldaapikey;
    axios.get(url)
        .then(function (response) {
            if (response.status != 200 && response.status != 201) {
                api_error(response);
                return;
            }
        
            var html = '<div><h2>Information från Leta anställda</h2>';
        
            if (response.data) {
                var json = response.data
                if (response.status == 201) {
                    html += "<p>Inga användare hittades</p>";
                } else {
                    //gå igenom alla users och lägg till i html
                    $.each(json, function(key, value) {
                        html += "<p>" + json[key].Fnamn + " " + json[key].Enamn + ", " +
                            json[key].KTH_id + ", " +
                            json[key].ORCIDid + ", " +
                            json[key].Orgnamn + ", " +
                            json[key].skola + ", " +
                            json[key].datum +
                            "</p>"
                    });
                }
            }
        
            html += '</div></div>'
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyresults').html(html);
        })
        .catch(function (error) {
            console.log(error);
        })
        .then(function () {
        });
}

function getScopus(doi) {
    $("#monkeyresultswrapper i").css("display", "inline-block");
    $("#monkeyresults").html("Apan pratar med Scopus...");
    var url = "https://api.elsevier.com/content/abstract/doi/" +
        doi +
        "?apiKey=f37c94f0e0ac2b22130965e88d76d788"// + scopusapikey;
    axios.get(url)
        .then(function (response) {
            console.log(response)
            var html = '';
            if (response.status == 201) {
                html += "<p>Hittade inget i Scopus</p>";
            } else {
                //hitta ScopusId
                var eid = response.data['abstracts-retrieval-response']['coredata']['eid']; //plocka värdet för ScopusId (eid)
                if(eid == "" 
                    || typeof eid === 'undefined' 
                    || eid == 'undefined') {
                    html += '<p>PubMedID hittades inte</p>';
                } else {
                    html += '<p>Uppdaterat ScopusID: ' + eid + '</p>';
                }
                $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val(eid); // skriv in det i fältet för ScopusId
                var pmid = response.data['abstracts-retrieval-response']['coredata']['pubmed-id']; //plocka värdet för PubMedID (PMID
                console.log(pmid)
                if(pmid == "" 
                    || typeof pmid === 'undefined' 
                    || pmid == 'undefined') {
                    html += '<p>PubMedID hittades inte</p>';
                } else {
                    html += '<p>Uppdaterat PubMedID: ' + pmid + '</p>';
                }
                $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
    
                var oa = response.data['abstracts-retrieval-response']['coredata']['openaccessFlag']; // plocka openaccessFlag true or false
    
                if (oa == 'true') { //sen jag bytte till absract search funkar detta som str men inte som boolean, varför?
                    document.getElementById(diva_id + ":doiFree").checked = true; // checka boxen
                } else {
                    document.getElementById(diva_id + ":doiFree").checked = false; // checka inte boxen... eller avchecka den
                }
                $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
                $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
                $(window).scrollTop(0);
                
            };
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyresults').html(html);
        })
        .catch(function (error) {
            console.log(error);
        })
        .then(function () {
        });
}

/**
 * Funktion som körs när iframe för notes-fältet skapats
 *
 */
function actionFunction() {
    console.log('actionFunction started')
    monkeylogin();
    //Kolla om användartoken finns och verifera i så fall, annars visa inloggning
    if (Cookies.get('token')) {
        if (typeof Cookies.get('token') === 'undefined' ||
            Cookies.get('token') == 'undefined' ||
            Cookies.get('token') == '') {
            Cookies.remove('token');
        } else {
            verifytoken(Cookies.get('token'));
            return
        }
    } else {
        Cookies.remove('token');
        $('#monkeylogin').css("display", "block");
    }

}

//////////////////////////////////////////////////////////
//
//Bevaka uppdateringar i noden som författarna ligger i
//Sker t ex efter "Koppla personpost"
//Initiera apan på nytt.
//
///////////////////////////////////////////////////////////
var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        var newNodes = mutation.addedNodes;
        if (newNodes !== null) {
            init();
            var $nodes = $(newNodes);
            $nodes.each(function() {
                var $node = $(this);
                if ($node.prop("id") == diva_id + ':authorSerie') {
                    console.log('author uppdaterad')
                }
            });
        }
    });
});
var config = {
    attributes: true,
    childList: true,
    characterData: true
};

///////////////////////////////////////////////////////////////////////////////////
//
//Hämta aktuellt id beroende på DiVA-läge (edit, publish, review eller import)
//Vänta på att element har skapats av DiVA
//
///////////////////////////////////////////////////////////////////////////////////
var diva_id
var authortarget
if (window.location.href.indexOf("editForm.jsf") !== -1) {
    waitForKeyElements('.diva2editmainer .diva2addtextbotmargin', function() {
        authortarget = $('.diva2editmainer .diva2addtextbotmargin')[0];
        observer.observe(authortarget, config);
    });
    waitForKeyElements('#diva2editcontainer', function() {
        diva_id = $('#diva2editcontainer').closest('form').attr('id')
    });
} else if (window.location.href.indexOf("publishForm.jsf") !== -1) {
    waitForKeyElements('.diva2pubmainer .diva2addtextbotmargin', function() {
        authortarget = $('.diva2pubmainer .diva2addtextbotmargin')[0];
        observer.observe(authortarget, config);
    });
    waitForKeyElements('#diva2editcontainer', function() {
        diva_id = $('#diva2editcontainer').closest('form').attr('id')
    });
} else if (window.location.href.indexOf("reviewForm.jsf") !== -1) {
    waitForKeyElements('.diva2reviewmainer .diva2addtextbotmargin', function() {
        authortarget = $('.diva2reviewmainer .diva2addtextbotmargin')[0];
        observer.observe(authortarget, config);
    });
    waitForKeyElements('#diva2editcontainer', function() {
        diva_id = $('#diva2editcontainer').closest('form').attr('id')
    });
} else if (window.location.href.indexOf("importForm.jsf") !== -1) {
    waitForKeyElements('.diva2impmainer .diva2addtextbotmargin .diva2addtextbotmargin', function() {
        authortarget = $('.diva2impmainer .diva2addtextbotmargin .diva2addtextbotmargin')[0];
        observer.observe(authortarget, config);
    });
    waitForKeyElements('#diva2addcontainer', function() {
        diva_id = $('#diva2addcontainer').closest('form').attr('id')
    });
} else {
    diva_id = "addForm";
}

//Overlay för att visa "popup" på sidan
var ldapoverlay = $('<div id="ldapoverlay"></div>');
$('body.diva2margin').append(ldapoverlay);

//DIV för att visa Apans resultat till vänster på sidan
var monkeyresults = $('<div id="monkeyresultswrapper"><h2>Apans resultat</h2><i class="fa fa-spinner fa-spin"></i><div id="monkeyresults" class="flexbox column"></div></div>');
$('body.diva2margin').append(monkeyresults);

//Visa loader...
$("#monkeyresultswrapper i").css("display", "inline-block");
$("#monkeyresults").html("Apan gör sig redo...");

//Vänta tills fältet för anmärkning skapats (iframe)
waitForKeyElements('#' + diva_id + '\\:notes_ifr', actionFunction);

//Skapa QC + dagens datum
var d = new Date();
var day = addZero(d.getDate());
var month = addZero(d.getMonth() + 1);
var year = addZero(d.getFullYear());
var QC = "QC " + year + month + day;

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

//--CSS:
GM_addStyle(`
@import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css");

#clarivateButtonjq i,
#monkeyresultswrapper i {
    display: none;
}

#monkeylogin {
    display: none;
    overflow: hidden;
    padding: 5px;
}

#monkeyresultswrapper {
    position:fixed; 
    top:0px; 
    left:0; 
    width:300px; 
    height:100%; 
    overflow:auto;
    padding-left: 10px;
    background: #ffffff
}

#monkeyresults {
    padding: 0px 10px 10px 0px;
    font-size: 10px;
}

#monkeyresults a, #ldapoverlay a {
    font-size: 0.8rem !important;
}

.ldapusers span {
    word-break: break-all;
}

.flexbox {
    display: flex;
}

.column {
    flex-direction: column;
}

.rowpadding {
    padding-top: 5px;
    padding-bottom: 5px;
}

.rowmargin {
    margin-top: 5px;
    margin-bottom: 5px;
}

button {
    background-color: #d85497;
    color: #fff;
    border-color: #d85497;
    border: 1px solid transparent;
    padding: .375rem .75rem;
    font-size: 1rem;
    line-height: 1.5;
    border-radius: .25rem;
    outline: none;
}

#ldapoverlay {
    position: fixed;
    height: 100%;
    width: 100%;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0,0,0,0.8);
    display: none;
    font-size: 0.8rem
}

#popup {
    max-width: 1200px;
    width: 80%;
    max-height: 1000px;
    overflow: scroll;
    height: 80%;
    padding: 20px;
    position: relative;
    background: #fff;
    margin: 20px auto;
}

#close {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    color: #000;
}
`);