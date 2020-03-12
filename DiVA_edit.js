// ==UserScript==
// @name     DiVA_edit
// @version      1.0.2
// @updateURL    https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA_edit.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA_edit.js
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf
// @require  https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant    GM_xmlhttpRequest
// @grant    GM_addStyle
// @connect  apps.lib.kth.se
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */

var apiURL = "https://apps.lib.kth.se/webservices/mrbs/api/v1/noauth/rooms"

function callapi() {
    GM_xmlhttpRequest ( {
        method:         "GET",
        url:            apiURL,
        responseType:   "json",
        onload:         processJSON_Response,
        onabort:        reportAJAX_Error,
        onerror:        reportAJAX_Error,
        ontimeout:      reportAJAX_Error
    } );
}

//Hantera API-svar och utför eventuella åtgärder
function processJSON_Response (response) {
    if (response.status != 200  &&  response.status != 304) {
        reportAJAX_Error (response);
        return;
    }

    var rooms = response.response;
    console.log(rooms);
    var roomName  = rooms[0].room_name;

    var resultsDiv  = `
        <p>${roomName}</p>
    `;

    var $iframe = $('#' + diva_id + '\\:notes_ifr');
    $iframe.ready(function() {
        $iframe.contents().find("body").html(resultsDiv);
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

//Skapa en knapp vid "Anmärknings-fältet"
var qcButton       = document.createElement ('div');
qcButton.innerHTML = '<button id="myButton" type="button">'
                + 'Infoga QC datum</button>'
                ;
document.getElementById(diva_id + ":notes").parentNode.appendChild (qcButton)

//Koppla action till klick på knappen
document.getElementById ("myButton").addEventListener (
    "click", ButtonClickAction, false
);

//Vänta tills fältet skapats (iframe)
waitForKeyElements('#' + diva_id + '\\:notes_ifr', actionFunction);

function actionFunction() {
    var $iframe = $('#' + diva_id + '\\:notes_ifr');
    $iframe.ready(function() {
        $iframe.contents().find("body").html(QC);
    });
    callapi();
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

//-- Style the results:
GM_addStyle ( `
    
` );
