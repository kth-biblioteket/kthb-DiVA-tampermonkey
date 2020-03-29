// ==UserScript==
// @name     DiVA
// @version      1.0.12
// @description  En Apa för att hjälpa till med DiVA-arbetet på KTH Biblioteket
// @author Thomas Lind
// @updateURL    https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf
// @match    https://kth.diva-portal.org/dream/import/importForm.jsf
// @match    https://kth.diva-portal.org/dream/publish/publishForm.jsf
// @match    https://kth.diva-portal.org/dream/review/reviewForm.jsf
// @match    https://kth.diva-portal.org/dream/info.jsf
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf?rvn=1
// @match    https://kth.diva-portal.org/dream/import/importForm.jsf?rvn=1
// @match    https://kth.diva-portal.org/dream/publish/publishForm.jsf?rvn=1
// @match    https://kth.diva-portal.org/dream/review/reviewForm.jsf?rvn=1
// @match    https://kth.diva-portal.org/dream/info.jsf?rvn=1
// @require  https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require  https://cdn.jsdelivr.net/npm/js-cookie@rc/dist/js.cookie.min.js
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
 * Funktion för att anropa api:er
 *
 * @param {string} apiURL
 * @param {function} callback
 */
function callapi(apiURL, callback) {
    GM_xmlhttpRequest({
        method: "GET",
        url: apiURL,
        responseType: "json",
        headers: {
            "Accept": "application/json"
        },
        onload: callback,
        onabort: reportAJAX_Error,
        onerror: reportAJAX_Error,
        ontimeout: reportAJAX_Error
    });
}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {object} response
 */
function processJSON_Response_default(response) {
    if (response.status != 200 && response.status != 304) {
        reportAJAX_Error(response);
        return;
    }

    console.log(response.response);

}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {object} response
 */

function processJSON_Response_LDAP(response) {
    if (response.status != 200 && response.status != 201) {
        reportAJAX_Error(response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Information från KTH UG(LDAP)</h2>';

    if (response.response) {
        var json = response.response
        if (response.status == 201) {
            html += "<p>Inga användare hittades</p>";
        } else {
            //gå igenom alla users och lägg till i html
            $.each(json.ugusers, function(key, value) {
                html += "<p>" + json.ugusers[key].displayName + ", " +
                    json.ugusers[key].ugKthid + ", " +
                    json.ugusers[key].title + ", " +
                    json.ugusers[key].kthPAGroupMembership +
                    "</p>"
            });
        }
    }

    html += '</div></div>'
    $('#ldapoverlay').html(html);
    $('#ldapoverlay').css("display", "block");
    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function() {
        $('#ldapoverlay').css("display", "none");
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {object} response
 */
function processJSON_Response_LETA(response) {
    if (response.status != 200 && response.status != 201) {
        reportAJAX_Error(response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Information från Leta anställda</h2>';

    if (response.response) {

        var json = response.response
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
    $('#ldapoverlay').html(html);
    $('#ldapoverlay').css("display", "block");
    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function() {
        $('#ldapoverlay').css("display", "none");
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {object} response
 */
function processJSON_Response_ORCID(response) {
    if (response.status != 200 && response.status != 201) {
        reportAJAX_Error(response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Information från ORCiD</h2>';
    if (response.response) {

        var json = response.response
        if (response.status == 201) {
            html += "<p>Inga användare hittades</p>";
        } else {
            //gå igenom alla users och lägg till i html
            $.each(json, function(key, value) {
                html += '<p><a target="_new" href="' + json[key]['orcid-identifier'].uri + '">' +
                    json[key]['orcid-identifier'].uri + ", " + json[key].person.name['family-name'].value + " " + json[key].person.name['given-names'].value
                if (json[key]["activities-summary"].employments["affiliation-group"].length > 0) {
                    console.log(json[key]["activities-summary"].employments["affiliation-group"])
                    $.each(json[key]["activities-summary"].employments["affiliation-group"], function(empkey, empvalue) {
                        html += ", " + json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"].organization.name
                        if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"]) {
                            if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].year) {
                                html += ", " + json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].year.value
                            }
                            if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].month) {
                                html += "-" + json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].month.value
                            }
                            if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].day) {
                                html += "-" + json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].day.value
                            }
                        }
                    })
                }
                html += '</a></p>'
            });
        }
    }

    html += '</div></div>'
    $('#ldapoverlay').html(html);
    $('#ldapoverlay').css("display", "block");
    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function() {
        $('#ldapoverlay').css("display", "none");
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar API-svar från Scopus och utför eventuella åtgärder.
 *
 * @param {object} response
 */

function processJSON_Response_scopus(response) {
    if (response.status != 200 && response.status != 201) {
        reportAJAX_Error(response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Scopus:</h2>';

    if (response.response) {
        var json = response.response
        if (response.status == 201) {
            html += "<p>Hittade inget i Scopus</p>";
        } else {
            //hitta ScopusId
            html += "<p>" + response.response['search-results'].entry[0]['dc:creator'] + ": <i>" +
                response.response['search-results'].entry[0]['dc:title'] + "</i><br /><br />" +
                "ScopusId: " + response.response['search-results'].entry[0]['eid'] + "<br />" +
                "DOI: " + response.response['search-results'].entry[0]['prism:doi'] + "<br />" +
                "PMID: " + response.response['search-results'].entry[0]['pubmed-id'] + "<br />" +
                "Open Access: " + response.response['search-results'].entry[0]['openaccessFlag'] + "<br />" +
                "</p>"
            var eid = response.response['search-results'].entry[0]['eid']; //plocka värdet för ScopusId (eid)
            $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val(eid); // skriv in det i fältet för ScopusId
            var pmid = response.response['search-results'].entry[0]['pubmed-id']; //plocka värdet för PubMedID (PMID
            $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
            var oa = response.response['search-results'].entry[0]['openaccessFlag']; // plocka openaccessFlag true or false
            if (oa == true) {
                document.getElementById(diva_id + ":doiFree").checked = true; // checka boxen
            } else {
                document.getElementById(diva_id + ":doiFree").checked = false; // checka inte boxen... eller avchecka den
            }
        };
    }

    html += '</div></div>'

    $('#ldapoverlay').html(html);
    $('#ldapoverlay').css("display", "block");

    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function() {
        $('#ldapoverlay').css("display", "none");
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar fel från api:er
 *
 * @param {object} response
 */
function reportAJAX_Error(response) {
    console.error(`Error ${response.status}!  ${response.statusText}`);
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
 * Funktion för att anrop DBLP och hämta information via DOI
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
 * Funktion för att initiera Apan
 *
 */
function init() {
    //Skapa en knapp överst
    $('#DiVAButtonjq').remove();
    var DiVAButtonjq = $('<button id="DiVAButtonjq" type="button">Sök i DiVA</button>');
    //bind en clickfunktion som anropar "DiVA-API" med titelfältet
    var $maintitleiframe;
    waitForKeyElements("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')", function() {
        $maintitleiframe = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first();
    });
    DiVAButtonjq.on("click", function() {
        getDiVA($maintitleiframe.contents().find("body").html(), 'csl_json');
    })
    $(".diva2editmainer").before(DiVAButtonjq)
    $(".diva2impmainer").before(DiVAButtonjq)
    $(".diva2reviewmainer").before(DiVAButtonjq)
    $(".diva2pubmainer").before(DiVAButtonjq)

    //Skapa en knapp vid titelfältet för att splitta titel i huvud- och undertitel vid kolon :
    $('#titlesplitButtonjq').remove();
    var titlesplitButtonjq = $('<button id="titlesplitButtonjq" type="button">Split : </button>');
    //bind en clickfunktion
    titlesplitButtonjq.on("click", function() {
        var $maintitleiframe;
        $maintitleiframe = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first();
        var $subtitleiframe;
        $subtitleiframe = $("div.diva2addtextchoicecol:contains('Undertitel:') , div.diva2addtextchoicecol:contains('Subtitle:')").next().find('iframe').first();
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

    //Skapa en knapp vid titelfältet för att ändra versaler till gemener förutom första bokstaven
    $('#caseButtonjq').remove();
    var caseButtonjq = $('<button id="caseButtonjq" type="button">A->a</button>');
    //bind en clickfunktion
    caseButtonjq.on("click", function() {
        var $maintitleiframe;
        $maintitleiframe = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first();
        var $subtitleiframe;
        $subtitleiframe = $("div.diva2addtextchoicecol:contains('Undertitel:') , div.diva2addtextchoicecol:contains('Subtitle:')").next().find('iframe').first();
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

    //Skapa en knapp vid titelfältet för proceedings, att splitta titel i huvud- och undertitel vid kolon :
    $('#proctitlesplitButtonjq').remove();
    var proctitlesplitButtonjq = $('<button id="proctitlesplitButtonjq" type="button">Split : </button>');
    //bind en clickfunktion
    proctitlesplitButtonjq.on("click", function() {
        var $procmaintitleiframe;
        $procmaintitleiframe = $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding') , div.diva2addtextchoice2:contains('Part of proceedings')").parent().next().next().find('iframe').first();
        var $procsubtitleiframe;
        $procsubtitleiframe = $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding') , div.diva2addtextchoice2:contains('Part of proceedings')").parent().next().next().next().next().find('iframe').first();
        var procmaintitle = $procmaintitleiframe.contents().find("body").html();
        var procsubtitle = $procsubtitleiframe.contents().find("body").html();
        var changedprocmaintitle = procmaintitle.split(":")[0];
        procsubtitle = procmaintitle.split(":")[1];
        $procmaintitleiframe.contents().find("body").html(changedprocmaintitle);
        $procsubtitleiframe.contents().find("body").html(procsubtitle);
    })

    $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding'), div.diva2addtextchoice2:contains('Part of proceedings')").parent().before(proctitlesplitButtonjq)

    //Skapa en knapp vid titelfältet för proceedings, att ändra versaler till gemener förutom första bokstaven
    $('#proctitlecaseButtonjq').remove();
    var proctitlecaseButtonjq = $('<button id="proctitlecaseButtonjq" type="button">A->a</button>');
    //bind en clickfunktion
    proctitlecaseButtonjq.on("click", function() {
        var $procmaintitleiframe;
        $procmaintitleiframe = $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding') , div.diva2addtextchoice2:contains('Part of proceedings')").parent().next().next().find('iframe').first();
        var $procsubtitleiframe;
        $procsubtitleiframe = $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding') , div.diva2addtextchoice2:contains('Part of proceedings')").parent().next().next().next().next().find('iframe').first()
        var procmaintitle = $procmaintitleiframe.contents().find("body").html();
        var procsubtitle = $procsubtitleiframe.contents().find("body").html();
        var changedprocmaintitle = procmaintitle.charAt(0) + procmaintitle.substring(1).toLowerCase();
        var changedprocsubtitle = procsubtitle.charAt(0) + procsubtitle.substring(1).toLowerCase();
        $procmaintitleiframe.contents().find("body").html(changedprocmaintitle);
        $procsubtitleiframe.contents().find("body").html(changedprocsubtitle);
    })

    $("div.diva2addtextchoice2:contains('Ingår i konferensmeddelande, proceeding'), div.diva2addtextchoice2:contains('Part of proceedings')").parent().before(proctitlecaseButtonjq)

    //Skapa en knapp vid titelfältet för böcker, att splitta titel i huvud- och undertitel vid kolon :
    $('#booktitlesplitButtonjq').remove();
    var booktitlesplitButtonjq = $('<button id="booktitlesplitButtonjq" type="button">Split : </button>');
    //bind en clickfunktion
    booktitlesplitButtonjq.on("click", function() {
        var $bookmaintitleiframe;
        $bookmaintitleiframe = $("div.diva2addtextchoice2:contains('Ingår i bok') , div.diva2addtextchoice2:contains('Part of book')").parent().next().next().find('iframe').first();
        var $booksubtitleiframe;
        $booksubtitleiframe = $("div.diva2addtextchoice2:contains('Ingår i bok') , div.diva2addtextchoice2:contains('Part of book')").parent().next().next().next().next().find('iframe').first();
        var bookmaintitle = $bookmaintitleiframe.contents().find("body").html();
        var booksubtitle = $booksubtitleiframe.contents().find("body").html();
        var changedbookmaintitle = bookmaintitle.split(":")[0];
        booksubtitle = bookmaintitle.split(":")[1];
        $bookmaintitleiframe.contents().find("body").html(changedbookmaintitle);
        $booksubtitleiframe.contents().find("body").html(booksubtitle);
    })

    $("div.diva2addtextchoice2:contains('Ingår i bok'), div.diva2addtextchoice2:contains('Part of book')").parent().before(booktitlesplitButtonjq)

    //Skapa en knapp vid titelfältet för böcker, att ändra versaler till gemener förutom första bokstaven
    $('#booktitlecaseButtonjq').remove();
    var booktitlecaseButtonjq = $('<button id="booktitlecaseButtonjq" type="button">A->a</button>');
    //bind en clickfunktion
    booktitlecaseButtonjq.on("click", function() {
        var $bookmaintitleiframe;
        $bookmaintitleiframe = $("div.diva2addtextchoice2:contains('Ingår i bok') , div.diva2addtextchoice2:contains('Part of book')").parent().next().next().find('iframe').first();
        var $booksubtitleiframe;
        $booksubtitleiframe = $("div.diva2addtextchoice2:contains('Ingår i bok') , div.diva2addtextchoice2:contains('Part of book')").parent().next().next().next().next().find('iframe').first()
        var bookmaintitle = $bookmaintitleiframe.contents().find("body").html();
        var booksubtitle = $booksubtitleiframe.contents().find("body").html();
        var changedbookmaintitle = bookmaintitle.charAt(0) + bookmaintitle.substring(1).toLowerCase();
        var changedbooksubtitle = booksubtitle.charAt(0) + booksubtitle.substring(1).toLowerCase();
        $bookmaintitleiframe.contents().find("body").html(changedbookmaintitle);
        $booksubtitleiframe.contents().find("body").html(changedbooksubtitle);
    })

    $("div.diva2addtextchoice2:contains('Ingår i bok'), div.diva2addtextchoice2:contains('Part of book')").parent().before(booktitlecaseButtonjq)

    //Skapa en knapp vid alternativtitelfältet, att splitta titel i huvud- och undertitel vid kolon :
    $('#alttitlesplitButtonjq').remove();
    var alttitlesplitButtonjq = $('<button id="alttitlesplitButtonjq" type="button">Split : </button>');
    //bind en clickfunktion
    alttitlesplitButtonjq.on("click", function() {
        var $altmaintitleiframe;
        $altmaintitleiframe = $("div.diva2addtextchoice2:contains('Alternativ') , div.diva2addtextchoice2:contains('Alternative')").parent().next().find('iframe').first();
        var $altsubtitleiframe;
        $altsubtitleiframe = $("div.diva2addtextchoice2:contains('Alternativ') , div.diva2addtextchoice2:contains('Alternative')").parent().next().next().next().find('iframe').first();
        var altmaintitle = $altmaintitleiframe.contents().find("body").html();
        var altsubtitle = $altsubtitleiframe.contents().find("body").html();
        var changedaltmaintitle = altmaintitle.split(":")[0];
        altsubtitle = altmaintitle.split(":")[1];
        $altmaintitleiframe.contents().find("body").html(changedaltmaintitle);
        $altsubtitleiframe.contents().find("body").html(altsubtitle);
    })

    $("div.diva2addtextchoice2:contains('Alternativ'), div.diva2addtextchoice2:contains('Alternative')").parent().before(alttitlesplitButtonjq)

    //Skapa en knapp vid alternativtitelfältet, att ändra versaler till gemener förutom första bokstaven
    $('#alttitlecaseButtonjq').remove();
    var alttitlecaseButtonjq = $('<button id="alttitlecaseButtonjq" type="button">A->a</button>');
    //bind en clickfunktion
    alttitlecaseButtonjq.on("click", function() {
        var $altmaintitleiframe;
        $altmaintitleiframe = $("div.diva2addtextchoice2:contains('Alternativ') , div.diva2addtextchoice2:contains('Alternative')").parent().next().find('iframe').first();
        var $altsubtitleiframe;
        $altsubtitleiframe = $("div.diva2addtextchoice2:contains('Alternativ') , div.diva2addtextchoice2:contains('Alternative')").parent().next().next().next().find('iframe').first()
        var altmaintitle = $altmaintitleiframe.contents().find("body").html();
        var altsubtitle = $altsubtitleiframe.contents().find("body").html();
        var changedaltmaintitle = altmaintitle.charAt(0) + altmaintitle.substring(1).toLowerCase();
        var changedaltsubtitle = altsubtitle.charAt(0) + altsubtitle.substring(1).toLowerCase();
        $altmaintitleiframe.contents().find("body").html(changedaltmaintitle);
        $altsubtitleiframe.contents().find("body").html(changedaltsubtitle);
    })

    $("div.diva2addtextchoice2:contains('Alternativ'), div.diva2addtextchoice2:contains('Alternative')").parent().before(alttitlecaseButtonjq)

    //Skapa en knapp vid "ISI-fältet"
    $('#WoSButtonjq').remove();
    var WoSButtonjq = $('<button id="WoSButtonjq" type="button">WoS</button>');
    //bind en clickfunktion som anropar WoS med värdet i DOI-fältet
    WoSButtonjq.on("click", function() {
        var url = "http://ws.isiknowledge.com/cps/openurl/service?url_ver=Z39.88-2004&req_id=mailto%3Apublicering%40kth.se&&rft_id=info%3Adoi%2F" +
        var url = "https://focus.lib.kth.se/login?url=http://ws.isiknowledge.com/cps/openurl/service?url_ver=Z39.88-2004&req_id=mailto%3Apublicering%40kth.se&&rft_id=info%3Adoi%2F" +
            $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val() +
            "";
        window.open(url, '_blank'); // sök på DOI i WoS och öppna ett nytt fönster
    })

    $("div.diva2addtextchoicecol:contains('ISI')").before(WoSButtonjq)

    //Skapa en knapp vid "Scopus-fältet"
    $('#scopusButtonjq').remove();
    var scopusButtonjq = $('<button id="scopusButtonjq" type="button">Scopus</button>');
    //bind en clickfunktion som anropar API med värdet i DOI-fältet
    scopusButtonjq.on("click", function() {
        var url = "https://api.elsevier.com/content/search/scopus?query=DOI(" +
            $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val() +
            ")&apiKey=" + scopusapikey;
        callapi(url, processJSON_Response_scopus);
    })

    $("div.diva2addtextchoicecol:contains('ScopusID')").before(scopusButtonjq)

    //Skapa en knapp vid "Konferens-fältet"
    $('#dblpButtonjq').remove();
    var dblpButtonjq = $('<button id="dblpButtonjq" type="button">dblp</button>');
    //bind en clickfunktion som anropar API med värdet i DOI-fältet
    dblpButtonjq.on("click", function() {
        getDblp($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
    })
    $("div.diva2addtextchoicecol:contains('Konferens') , div.diva2addtextchoicecol:contains('Conference') ").after(dblpButtonjq);

    //Länk till hjälpsida i Confluence
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

    //Kolla så att inte det finns dubbletter
    $('#dubblettButtonjq').remove();
    var dubblettButtonjq = $('<button id="dubblettButtonjq" type="button">Dubblett?</button>');
    //bind en clickfunktion som anropar DiVA KTH:s webbgränssnitt och söker på titel
    dubblettButtonjq.on("click", function() {
        var url = "https://kth.diva-portal.org/smash/resultList.jsf?dswid=-4067&language=en&searchType=RESEARCH&query=&af=%5B%5D&aq=%5B%5B%7B%22titleAll%22%3A%22"
            //    + $(document.getElementById(diva_id + ":j_id774")).val()
            +
            $("div.diva2addtextchoicebr:contains('Title'), div.diva2addtextchoicebr:contains('Titel')").parent().find('textarea').eq(0).val() // https://stackoverflow.com/questions/2416803/jquery-contains-selector-to-search-for-multiple-strings/2417076#2417076
            +
            "%22%7D%5D%5D&aq2=%5B%5B%5D%5D&aqe=%5B%5D&noOfRimportForm:j_id758ows=50&sortOrder=author_sort_asc&sortOrder2=title_sort_asc&onlyFullText=false&sf=all"
        window.open(url, '_blank'); // sök i DiVA webb på titel, öppna i ett nytt fönster

    })

    $(".diva2editmainer").before(dubblettButtonjq) // dubblettknapp längst upp på sidan
    $(".diva2impmainer").before(dubblettButtonjq)
    $(".diva2reviewmainer").before(dubblettButtonjq)
    $(".diva2pubmainer").before(dubblettButtonjq)

    //Skapa en knapp vid "Anmärknings-fältet"
    $('#qcButton').remove();
    var qcButton = $('<button id="qcButton" type="button">Infoga QC datum</button>');
    qcButton.on("click", function() {
        var $iframe = $('#' + diva_id + '\\:notes_ifr');
        $iframe.ready(function() {
            $iframe.contents().find("body p").html($iframe.contents().find("body p").html() + QC);
        });
    })
    $('#' + diva_id + '\\:notes').after(qcButton)


    ////Skapa en knapp vid "Annan organisation" för varje författare, för att kunna radera detta fält när vi kopplat en KTH-person
    var otherorg = $('#' + diva_id + '\\:authorSerie');
    var j = 0;
    $(otherorg).find("div.diva2addtextchoicecol:contains('Annan organisation') , div.diva2addtextchoicecol:contains('Other organisation')").each(function() {
        var thiz = this;

        //CLEAR ORG
        var clearorgButtonjq = $('<button id="clearorgButtonjq' + j + '" type="button">Clear org</button>');
        //bind en clickfunktion som skall rensa fältet för "Annan organisation"
        clearorgButtonjq.on("click", function() {
            $(thiz).next().find('input').val("");
            console.log(thiz);
        })

        $(this).parent().after(clearorgButtonjq);
        //      $("div.diva2addtextchoicecol:contains('Annan organisation'), div.diva2addtextchoicecol:contains('Other organisation')").parent().after(clearorgButtonjq)

        j++;
    });


    //Skapa knappar vid "Författar-avsnittet"(jquery)
    var authors = $('#' + diva_id + '\\:authorSerie');
    var i = 0;
    $(authors).find('.diva2addtextarea').each(function() {
        var thiz = this;

        //LDAP/UG
        var ldapButtonjq = $('<button id="ldapButtonjq' + i + '" type="button">LDAP-info</button>');
        //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
        ldapButtonjq.on("click", function() {
            var url = "https://lib.kth.se/ldap/api/v1/users/" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "* " +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                " *" +
                "?token=" + ldapapikey;
            var newurl = url.replace("$$$", "") // ta bort $$$ från efternamnen för sökning i Leta KTH-anställda
            callapi(newurl, processJSON_Response_LDAP);
        })
        $(this).before(ldapButtonjq)

        //Leta KTH-anställda
        var letaButtonjq = $('<button id="letaButtonjq' + i + '" type="button">Leta anställda</button>');
        //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
        letaButtonjq.on("click", function() {
            var url = "https://apps-ref.lib.kth.se/webservices/letaanstallda/api/v1/users?fname=" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "%&ename=" +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                "%" +
                "&api_key=" + letaanstalldaapikey;
            var newurl = url.replace("$$$", "") // ta bort $$$ från efternamnen för sökning i Leta KTH-anställda
            callapi(newurl, processJSON_Response_LETA);
        })

        $(this).before(letaButtonjq)

        //Sök i ORCiD
        var orcidButtonjq = $('<button id="orcidButtonjq' + i + '" type="button">Sök ORCiD</button>');
        //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
        orcidButtonjq.on("click", function() {
            var url = "http://lib.kth.se/orcid/api/v1/orcid/" +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                "/" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "/?token=" + orcidapikey;
            callapi(url, processJSON_Response_ORCID);
        })

        $(this).before(orcidButtonjq);

        //KTH Intranät förnamn efternamn
        var kthintraButtonjq = $('<button id="kthintraButtonjq' + i + '" type="button">KTH Intra</button>');
        //bind en clickfunktion som anropar KTH Intranät med de värden som finns i för- och efternamn
        kthintraButtonjq.on("click", function() {
            var url = "https://www.kth.se/search?q=" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "%20" +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                "&urlFilter=https://intra.kth.se&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
            var newurl = url.replace("$$$", "") // ta bort eventuella $$$ från efternamnen före sökning
            window.open(newurl, '_blank'); // sök på förnamn efternamn på KTH Intranät
        })

        $(this).before(kthintraButtonjq)

        //Google.com förnamn + efternamn + KTH
        var googleButtonjq = $('<button id="googleButtonjq' + i + '" type="button">Google</button>');
        //bind en clickfunktion som anropar google.com med de värden som finns i för- och efternamn
        googleButtonjq.on("click", function() {
            var url = "https://www.google.com/search?q=KTH+" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "+" +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            var newurl = url.replace("$$$", "") // ta bort eventuella $$$ från efternamnen före sökning
            window.open(newurl, '_blank'); // sök på förnamn efternamn + KTH i google
        })

        $(this).before(googleButtonjq)

		//Sök i ORCiD
        var orcidButtonjq = $('<button id="orcidButtonjq' + i + '" type="button">Sök ORCiD</button>');
        //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
        orcidButtonjq.on("click", function() {
            var url = "https://lib.kth.se/orcid/api/v1/orcid/" +
                $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                "/" +
                $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                "/?token=" + orcidapikey;
            callapi(url, processJSON_Response_ORCID);
        })

        $(this).before(orcidButtonjq);

        i++;
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

//Bevaka uppdateringar i noden som författarna ligger i
//Sker t ex efter "Koppla personpost"
//Initiera apan på nytt.
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

//Hämta aktuellt id beroende på DiVA-läge (edit, publish, review eller import)
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

//Lägg in overlay för LDAP-resultat på sidan så den kan visas
$('<div/>', {
    id: 'ldapoverlay'
}).appendTo('body.diva2margin');

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
#monkeylogin {
    display: none;
    overflow: hidden;
    padding: 5px;
}
#ldapoverlay a {
    font-size: 0.8rem !important;
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