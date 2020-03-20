// ==UserScript==
// @name     DiVA
// @version      1.0.5
// @description  En Apa för att hjälpa till med DiVA-arbetet på KTH Biblioteket
// @author Thomas Lind
// @updateURL    https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf
// @match    https://kth.diva-portal.org/dream/import/importForm.jsf
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
 * @param {
 * } keys
 */
function setapikeys(keys){
    ldapapikey = keys.apikeys.ldap;
    orcidapikey = keys.apikeys.orcid;
    letaanstalldaapikey = keys.apikeys.letaanstallda;
    scopusapikey = keys.apikeys.scopus;
}

/**
 * Funktion som verifierar användarens JWT-token
 *
 * @param {
 * } token
 */
function verifytoken(token) {
    //$('#monkeylogin').remove();
    $('#monkeylogin').fadeOut(300);
    $('#username').val('');
    $('#password').val('');
    if(token) {
        $.ajax ({
            type:       'POST',
            url:        'https://lib.kth.se/ldap/api/v1/divamonkey',
            dataType:   'JSON',
            headers:    {'x-access-token':  token},
            success:
            function (response, textStatus, xhr) {
                //om användaren inte tillhör bibblan
                if(xhr.status == 201) {
                    alert('not authorized');
                    $('#monkeylogin').fadeIn(300);
                    return;
                };
                //Om behörig bibblananvändare
                if(response.apikeys) {
                    //Spara token i en cookie (som gäller lång hur tid?)
                    Cookies.set('token', response.token)
                    setapikeys(response)
                    init();
                } else {
                    Cookies.remove('token')
                    $('#monkeylogin').fadeIn(300);
                }
            },
            error:
            //401 Unauthorized
            function (response, textStatus, xhr) {
                alert("Unauthorized")
                Cookies.remove('token')
                $('#monkeylogin').fadeIn(300);
            }
        });
    } else {
        Cookies.remove('token')
        $('#monkeylogin').fadeIn(300);
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
    loginButton.click(function(){
        var username = $('#username').val() + "@ug.kth.se";
        var password = $('#password').val();
        $.ajax ( {
            type:       'POST',
            url:        'https://lib.kth.se/ldap/api/v1/login',
            dataType:   'JSON',
            data:       { username: username , password: password },
            success:
            function (response) {
                verifytoken(response.token);
            },
            error:
            function (response, textStatus, xhr) {
                alert("Bad credentials, please try again");
            }
        } );
    });
}

/**
 * Funktion för att anropa api:er
 *
 * @param {
 * } apiURL
 * @param {*} callback
 */
function callapi(apiURL, callback) {
    GM_xmlhttpRequest ( {
        method:         "GET",
        url:            apiURL,
        responseType:   "json",
        headers: {
            "Accept": "application/json"
        },
        onload:         callback,
        onabort:        reportAJAX_Error,
        onerror:        reportAJAX_Error,
        ontimeout:      reportAJAX_Error
    } );
}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {
 * } response
 */
function processJSON_Response_default (response) {
    if (response.status != 200  &&  response.status != 304) {
        reportAJAX_Error (response);
        return;
    }

   console.log(response.response);

}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {
 * } response
 */
function processJSON_Response_LDAP (response) {
    if (response.status != 200  && response.status != 201) {
        reportAJAX_Error (response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Information från KTH UG(LDAP)</h2>';

    if(response.response) {
        var json = response.response
        if (response.status == 201) {
            html += "<p>Inga användare hittades</p>";
        } else {
            //gå igenom alla users och lägg till i html
            $.each(json.ugusers, function(key , value) {
                html += "<p>" + json.ugusers[key].displayName + ", "
                    + json.ugusers[key].ugKthid + ", "
                    + json.ugusers[key].title + ", "
                    + json.ugusers[key].kthPAGroupMembership
                    +"</p>"
            });
        }
    }

    html += '</div></div>'
    $('#ldapoverlay').html(html);
    $('#ldapoverlay').fadeIn(300);
    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function(){
        $('#ldapoverlay').fadeOut(300)
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {
 * } response
 */
function processJSON_Response_LETA (response) {
    if (response.status != 200  && response.status != 201) {
        reportAJAX_Error (response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Information från Leta anställda</h2>';

    if(response.response) {

        var json = response.response
        if (response.status == 201) {
            html += "<p>Inga användare hittades</p>";
        } else {
            //gå igenom alla users och lägg till i html
            $.each(json, function(key , value) {
                html += "<p>" + json[key].Fnamn + " " + json[key].Enamn + ", "
                    + json[key].KTH_id + ", "
                    + json[key].ORCIDid + ", "
                    + json[key].Orgnamn + ", "
                    + json[key].skola + ", "
                    + json[key].datum
                    +"</p>"
            });
        }
    }

    html += '</div></div>'
    $('#ldapoverlay').html(html);
    $('#ldapoverlay').fadeIn(300);
    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function(){
        $('#ldapoverlay').fadeOut(300)
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar API-svar och utför eventuella åtgärder.
 *
 * @param {
 * } response
 */
function processJSON_Response_ORCID (response) {
    if (response.status != 200  && response.status != 201) {
        reportAJAX_Error (response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Information från ORCiD</h2>';
    if(response.response) {

        var json = response.response
        if (response.status == 201) {
            html += "<p>Inga användare hittades</p>";
        } else {
            //gå igenom alla users och lägg till i html
            $.each(json, function(key , value) {
                html += '<p><a target="_new" href="' + json[key]['orcid-identifier'].uri + '">'
                    + json[key]['orcid-identifier'].uri + ", " + json[key].person.name['family-name'].value + " " + json[key].person.name['given-names'].value
                if (json[key]["activities-summary"].employments["affiliation-group"].length > 0) {
                    console.log(json[key]["activities-summary"].employments["affiliation-group"])
                    $.each(json[key]["activities-summary"].employments["affiliation-group"], function(empkey , empvalue) {
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
    $('#ldapoverlay').fadeIn(300);
    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function(){
        $('#ldapoverlay').fadeOut(300)
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar API-svar från Scopus och utför eventuella åtgärder.
 *
 * @param {
 * } response
 */

function processJSON_Response_scopus (response) {
    if (response.status != 200  && response.status != 201) {
        reportAJAX_Error (response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Scopus:</h2>';

    if(response.response) {
        var json = response.response
        if (response.status == 201) {
            html += "<p>Hittade inget i Scopus</p>";
        } else {
            //hitta ScopusId
            html += "<p>" + response.response['search-results'].entry[0]['dc:creator'] + ": <i>"
                + response.response['search-results'].entry[0]['dc:title'] + "</i><br /><br />"
                + "ScopusId: " + response.response['search-results'].entry[0]['eid'] + "<br />"
                + "DOI: " + response.response['search-results'].entry[0]['prism:doi'] + "<br />"
                + "PMID: " + response.response['search-results'].entry[0]['pubmed-id'] + "<br />"
                + "</p>"
        var eid = response.response['search-results'].entry[0]['eid']; //plocka värdet för ScopusId (eid)
        $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val(eid); // skriv in det i fältet för ScopusId
        var pmid = response.response['search-results'].entry[0]['pubmed-id']; //plocka värdet för PubMedID (PMID)
        $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
            };
    }

    html += '</div></div>'

    $('#ldapoverlay').html(html);
    $('#ldapoverlay').fadeIn(300);

    //Stängknapp till overlay
    var closeButton = $('#close');
    closeButton.click(function(){
        $('#ldapoverlay').fadeOut(300)
        $('#ldapoverlay').html('');
    });
}

/**
 * Funktion som hanterar fel från api:er
 *
 * @param {
 * } response
 */
function reportAJAX_Error (response) {
    console.error (`Error ${response.status}!  ${response.statusText}`);
}

/**
 * Funktion för att anrop DBLP och hämta information via DOI
 * @param {
 * } doi
 */
function getDblp(doi) {
    $.ajax ({
        type:       'GET',
        url:        'https://dblp.uni-trier.de/doi/xml/' + doi,
        dataType:   'xml',
        success:
        function (response, textStatus, xhr) {
            if($(response).find("crossref").text()){
                $.ajax ({
                    type:       'GET',
                    url:        'https://dblp.uni-trier.de/rec/xml/' + $(response).find("crossref").text(),
                    dataType:   'xml',
                    success:
                    function (response, textStatus, xhr) {
                        var html = '<div id="popup"><div id="close">X</div><h2>Information från dblp, DOI: ' + doi + '</h2>';
                        html += "<p>Title: " + $(response).find("title").text() + "</p>"
                            + "<p>Series: " + $(response).find("series").text() + "</p>"
                            + "<p>Volume: " + $(response).find("volume").text() + "</p>"
                            + '</div>'

                        $('#ldapoverlay').html(html);
                        $('#ldapoverlay').fadeIn(300);

                        //Stängknapp till overlay
                        var closeButton = $('#close');
                        closeButton.click(function(){
                            $('#ldapoverlay').fadeOut(300)
                            $('#ldapoverlay').html('');
                        });
                    },
                    error:
                    //TODO felhantering
                    function (response, textStatus, xhr) {
                        console.log(xhr);
                    }
                });
            } else {
                alert("Hittade inget i dblp på: " + doi);
            }
        },
        error:
        //TODO felhantering
        function (response, textStatus, xhr) {
            console.log(xhr);
        }
    });
}

/**
 * Funktion för att hantera klick på knapp
 *
 * @param {
 * } event
 */
function ButtonClickAction (event) {
    var $iframe = $('#' + diva_id + '\\:notes_ifr');
    $iframe.ready(function() {
        $iframe.contents().find("body").html(QC);
    });
}

//Hämta aktuellt id beroende på DiVA-läge (edit eller import)
var diva_id
if ( window.location.href.indexOf("editForm.jsf") !== -1 ) {
     waitForKeyElements('#diva2editcontainer', function() {
        diva_id = $('#diva2editcontainer').closest('form').attr('id')
    });
} else {
    diva_id = "importForm";
}

//Lägg in overlay för LDAP-resultat på sidan så den kan visas
$('<div/>', {
    id: 'ldapoverlay'
}).appendTo('body');

/**
 * Funktion för att initiera Apan
 *
 */
function init() {
    //Skapa en knapp vid "Scopus-fältet"
    var scopusButtonjq = $('<button id="scopusButtonjq" type="button">Scopus</button>');
    //bind en clickfunktion som anropar API med värdet i DOI-fältet
    scopusButtonjq.on("click",function() {
        var url = "https://api.elsevier.com/content/search/scopus?query=DOI("
             + $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val()
             + ")&apiKey=" + scopusapikey;
        callapi(url, processJSON_Response_scopus);
    })
    $( "div.diva2addtextchoicecol:contains('ScopusID')").before(scopusButtonjq)

    //Skapa en knapp vid "Konferens-fältet"
    var dblpButtonjq = $('<button id="dblpButtonjq" type="button">dblp</button>');
    //bind en clickfunktion som anropar API med värdet i DOI-fältet
    dblpButtonjq.on("click",function() {
        getDblp($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
    })
    $( "div.diva2addtextchoicecol:contains('Konferens')").after(dblpButtonjq)
    $( "div.diva2addtextchoicecol:contains('Conference')").after(dblpButtonjq)

    //Skapa en knapp vid "Anmärknings-fältet"(vanilla javascript)
    var qcButton       = document.createElement ('div');
    qcButton.innerHTML = '<button id="qcButton" type="button">'
        + 'Infoga QC datum</button>'
    ;
    document.getElementById(diva_id + ":notes").parentNode.appendChild (qcButton)

    //Koppla action till klick på knappen
    document.getElementById ("qcButton").addEventListener (
        "click", ButtonClickAction, false
    );

    //Skapa knappar vid "Författar-avsnittet"(jquery)
    var authors = $('#' + diva_id + '\\:authorSerie');
    var i = 0;
    $(authors).find('.diva2addtextarea').each(function () {
        var thiz = this;
        //LDAP/UG
        var ldapButtonjq = $('<button id="ldapButtonjq' + i + '" type="button">LDAP-info</button>');
        //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
        ldapButtonjq.on("click",function() {
            var url = "https://lib.kth.se/ldap/api/v1/users/"
            + $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val()
            + "* "
            + $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            + " *"
            + "?token=" + ldapapikey;
            var newurl =  url.replace("$$$", "") // ta bort $$$ från efternamnen för sökning i Leta KTH-anställda
            callapi(newurl, processJSON_Response_LDAP);
       //     callapi(url, processJSON_Response_LDAP);
        })
        $(this).before (ldapButtonjq)

        //Leta KTH-anställda
        var letaButtonjq = $('<button id="letaButtonjq' + i + '" type="button">Leta anställda</button>');
        //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
        letaButtonjq.on("click",function() {
            var url = "https://apps-ref.lib.kth.se/webservices/letaanstallda/api/v1/users?fname="
            + $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val()
            + "%&ename="
            + $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            + "%"
            + "&api_key=" + letaanstalldaapikey;
            var newurl =  url.replace("$$$", "") // ta bort $$$ från efternamnen för sökning i Leta KTH-anställda
            callapi(newurl, processJSON_Response_LETA);
     //       callapi(url, processJSON_Response_LETA);
        })

        $(this).before (letaButtonjq)

        //Sök i ORCiD
        var orcidButtonjq = $('<button id="orcidButtonjq' + i + '" type="button">Sök ORCiD</button>');
        //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
        orcidButtonjq.on("click",function() {
            //var url = "https://pub.orcid.org/v3.0/search/?q=family-name:"
            var url = "http://ref.lib.kth.se/orcid/api/v1/orcid/"
            + $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            //+ "+AND+given-names:"
            +"/"
            + $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val()
            //+ "affiliation-org-name:KTH"
            + "/?token=" + orcidapikey;
            console.log(url)
            callapi(url, processJSON_Response_ORCID);
        })


        $(this).before (orcidButtonjq);

        i++;
    });
}

//Vänta tills fältet för anmärkning skapats (iframe)
waitForKeyElements('#' + diva_id + '\\:notes_ifr', actionFunction);

/**
 * Funktion som körs när sidan iframe för notes-fältet skapats
 *
 */
function actionFunction() {
    monkeylogin();
    //Kolla om användartoken finns och verifera i så fall
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
        $('#monkeylogin').fadeIn(300);
    }

}

//Skapa QC + dagens datum
var d = new Date();
var day = addZero(d.getDate());
var month = addZero(d.getMonth()+1);
var year = addZero(d.getFullYear());

var QC = "QC " + year+month+day;

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

//--CSS:
GM_addStyle ( `
#monkeylogin {
    display: none;
    overflow: hidden;
    padding: 5px;
}
#ldapoverlay a {
    font-size: 1rem !important;
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
}
#popup {
   max-width: 1000px;
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
` );
