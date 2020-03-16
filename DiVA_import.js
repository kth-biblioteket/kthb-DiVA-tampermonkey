// ==UserScript==
// @name     DiVA_import
// @version      1.1.5
// @author Thomas Lind
// @updateURL    https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA_import.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA_import.js
// @match    https://kth.diva-portal.org/dream/import/importForm.jsf
// @require  https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant    GM_xmlhttpRequest
// @grant    GM_addStyle
// @connect  apps.lib.kth.se
// @connect  lib.kth.se
// @connect  pub.orcid.org
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */

var ldapapikey = "[LÄGG TILL APIKEY HÄR]";
var letaanstalldaapikey = "[LÄGG TILL APIKEY HÄR]"

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

//Hantera API-svar och utför eventuella åtgärder.
function processJSON_Response_MRBS (response) {
    if (response.status != 200  &&  response.status != 304) {
        reportAJAX_Error (response);
        return;
    }

    var rooms = response.response;

    var roomName  = rooms[0].room_name;

    var resultsDiv  = `
        <p>${roomName}</p>
    `;

    var $iframe = $('#' + diva_id + '\\:notes_ifr');
    $iframe.ready(function() {
        $iframe.contents().find("body").html(resultsDiv);
    });
}

//Hantera API-svar och utför eventuella åtgärder.
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
                    + json.ugusers[key].kthPAGroupMembership + ", "
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

//Hantera API-svar och utför eventuella åtgärder.
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
                    + json[key].Orgnamn
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

//Hantera API-svar och utför eventuella åtgärder.
function processJSON_Response_ORCID (response) {
    if (response.status != 200  && response.status != 201) {
        reportAJAX_Error (response);
        return;
    }

    var html = '<div id="popup"><div id="close">X</div><h2>Information från ORCiD</h2>';
    console.log(response)
    if(response.response) {

        var json = response.response.result
        if (response.response.result == null) {
            html += "<p>Inga användare hittades</p>";
        } else {
            //gå igenom alla users och lägg till i html
            $.each(json, function(key , value) {
                html += '<a target="_new" href="' + json[key]['orcid-identifier'].uri + '">'
                    + json[key]['orcid-identifier'].uri
                    + '</a>'
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

function reportAJAX_Error (response) {
    console.error (`Error ${response.status}!  ${response.statusText}`);
}

function ButtonClickAction (event) {
    var $iframe = $('#' + diva_id + '\\:notes_ifr');
    $iframe.ready(function() {
        $iframe.contents().find("body").html(QC);
    });
}

//Hämta aktuellt id
var diva_id = "importForm";

//Skapa en knapp vid "Anmärknings-fältet"(vanilla javascript)
var qcButton       = document.createElement ('div');
qcButton.innerHTML = '<button id="myButton" type="button">'
                + 'Infoga QC datum</button>'
                ;
document.getElementById(diva_id + ":notes").parentNode.appendChild (qcButton)

//Koppla action till klick på knappen
document.getElementById ("myButton").addEventListener (
    "click", ButtonClickAction, false
);

//Lägg in overlay för LDAP-resultat på sidan så den kan visas
$('<div/>', {
    id: 'ldapoverlay'
}).appendTo('body');

//Skapa knappar vid "Författar-avsnittet"(jquery)
var authors = $('#' + diva_id + '\\:authorSerie');
$(authors).find('.diva2addtextarea').each(function () {
    var thiz = this;

    //LDAP/UG
    var ldapButtonjq = $('<button id="myButton" type="button">LDAP-info</button>');
    //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
    ldapButtonjq.on("click",function() {
        var url = "https://lib.kth.se/ldap/api/v1/users/"
            + $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val()
            + "* "
            + $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            + " *"
            + "?token=" + ldapapikey;
        callapi(url, processJSON_Response_LDAP);
    })
    $(this).before (ldapButtonjq)

    //Leta KTH-anställda
    var letaButtonjq = $('<button id="myButton" type="button">Leta anställda</button>');
    //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
    letaButtonjq.on("click",function() {
        var url = "https://apps-ref.lib.kth.se/webservices/letaanstallda/api/v1/users?fname="
            + $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val()
            + "%&ename="
            + $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            + "%"
            + "&api_key=" + letaanstalldaapikey;
        callapi(url, processJSON_Response_LETA);
    })

    $(this).before (letaButtonjq)

    //Sök i ORCiD
    var orcidButtonjq = $('<button id="myButton" type="button">Sök ORCiD</button>');
    //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
    orcidButtonjq.on("click",function() {
        var url = "https://pub.orcid.org/v3.0/search/?q=family-name:"
            + $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            + "+AND+given-names:"
            + $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val()
            //+ "affiliation-org-name:KTH"
        console.log(url)
        callapi(url, processJSON_Response_ORCID);
    })

    $(this).before (orcidButtonjq)
});

//Vänta tills fältet för anmärkning skapats (iframe)
waitForKeyElements('#' + diva_id + '\\:notes_ifr', actionFunction);

function actionFunction() {
    var $iframe = $('#' + diva_id + '\\:notes_ifr');
    $iframe.ready(function() {
        $iframe.contents().find("body").append(QC);
    });
    //callapi("https://apps.lib.kth.se/webservices/mrbs/api/v1/noauth/rooms", processJSON_Response_MRBS);
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
a {
    font-size: 1rem !important;
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