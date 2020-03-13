// ==UserScript==
// @name     DiVA_edit
// @version      1.1.3
// @author Thomas Lind
// @updateURL    https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA_edit.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA_edit.js
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf
// @require  https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant    GM_xmlhttpRequest
// @grant    GM_addStyle
// @connect  apps.lib.kth.se
// @connect  lib.kth.se
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */

var ldapapikey = "[LÄGG TILL APIKEY HÄR]";

function callapi(apiURL, callback) {
    GM_xmlhttpRequest ( {
        method:         "GET",
        url:            apiURL,
        responseType:   "json",
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
var diva_id = $('#diva2editcontainer').closest('form').attr('id');

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

//Skapa en knapp vid "Författar-avsnittet"(jquery)
var authors = $('#' + diva_id + '\\:authorSerie');
$(authors).find('.diva2addtextarea').each(function () {
    var thiz = this;
    var authButtonjq = $('<button id="myButton" type="button">LDAP-info</button>');
    //bind en clickfunktion som anropar API med de värden som finns i för- och efternamn
    authButtonjq.on("click",function() {
        var url = "https://lib.kth.se/ldap/api/v1/users/"
            + $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val()
            + "* "
            + $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
            + " *"
            + "?token=" + ldapapikey;
        callapi(url, processJSON_Response_LDAP);
    })
    $(this).before (authButtonjq)
});

//Vänta tills fältet för anmärkning skapats (iframe)
waitForKeyElements('#' + diva_id + '\\:notes_ifr', actionFunction);

function actionFunction() {
    var $iframe = $('#' + diva_id + '\\:notes_ifr');
    $iframe.ready(function() {
        $iframe.contents().find("body").html(QC);
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
   max-width: 600px;
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