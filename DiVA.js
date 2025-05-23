// ==UserScript==
// @name     DiVA
// @version      2.3-general
// @description  En Apa för att hjälpa till med DiVA-arbetet på KTH Biblioteket
// @author Thomas Lind, Anders Wändahl, code contributions from Malmö University
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf*
// @match    https://kth.diva-portal.org/dream/import/importForm.jsf*
// @match    https://kth.diva-portal.org/dream/publish/publishForm.jsf*
// @match    https://kth.diva-portal.org/dream/review/reviewForm.jsf*
// @match    https://kth.diva-portal.org/dream/add/add2.jsf*
//
// @match    https://kth.test.diva-portal.org/dream/edit/editForm.jsf*
// @match    https://kth.test.diva-portal.org/dream/import/importForm.jsf*
// @match    https://kth.test.diva-portal.org/dream/publish/publishForm.jsf*
// @match    https://kth.test.diva-portal.org/dream/review/reviewForm.jsf*
// @match    https://kth.test.diva-portal.org/dream/add/add2.jsf*
//
// @require  https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require  https://cdn.jsdelivr.net/npm/js-cookie@rc/dist/js.cookie.min.js
// @require  https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js
// @grant    GM_xmlhttpRequest
// @grant    GM_addStyle
// @connect  apps.lib.kth.se
// @connect  api.lib.kth.se
// @connect  lib.kth.se
// @connect  pub.orcid.org
// @connect  localhost
// @connect  api.elsevier.com
// @connect  google.com
// @connect  kth.diva-portal.org
// @connect  ws.isiknowledge.com
// @connect  clarivate.com
// @connect  portal.issn.org
// @connect  www.worldcat.org
// @connect  dblp.uni-trier.de
// @connect  search.crossref.org
// @connect  api.crossref.org
// @connect  bibliometri.swepub.kb.se
// @connect  www.semanticscholar.org
// @connect  www.example.net
// @connect  github.com

// @noframes
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */
(function() {
    ///////////////////////////////
    //
    // Variabler
    //
    ///////////////////////////////

    /**
     *
     * Konfigurera monkey_config för respektive lärosäte
     *
     * Aktivera/inaktivera aktuella funktioner som apan ska hantera
     * (wos : true,
     * scopus : false
     * etc)
     *
     * Ange url:er, api-nycklar(scopus_api_url,scopus_apikey... etc)
     * exvis:
     * scopus_api_url : 'https://api.elsevier.com/content/abstract/doi',
     * scopus_apikey : 'ER EGEN NYCKEL',
     * etc
     */
    var monkey_config = {
        login: true,
        ldap: true,
        letaanstallda: true,
        orcid: true,
        intranet: true,
        wos: true,
        scopus: true,
        qc: true,
        monkey_image_url: "https://raw.githubusercontent.com/kth-biblioteket/kthb-DiVA-tampermonkey/master/images/apa.jpg",
        oa_image_url: "https://raw.githubusercontent.com/kth-biblioteket/kthb-DiVA-tampermonkey/master/images/oa.png",
        university: 'KTH',
        diva_search_api_url: 'https://kth.diva-portal.org/smash/export.jsf',
        diva_search_url: 'https://kth.diva-portal.org/smash/resultList.jsf',
        help_url: "https://confluence.sys.kth.se/confluence/pages/viewpage.action?pageId=74259261",
        university_search_url: 'https://www.kth.se/search',
        university_url: 'https://www.kth.se',
        university_intranet_url: 'https://intra.kth.se',
        scopus_api_url: 'https://api.elsevier.com/content/abstract/doi',
        dblp_api_doi_url: 'https://dblp.uni-trier.de/doi/xml',
        dblp_api_rec_url: 'https://dblp.uni-trier.de/rec/xml',
        wos_api_url_lite: 'https://wos-api.clarivate.com/api/woslite/?databaseId=WOS&count=1&firstRecord=1',
        wos_api_url: 'https://api.clarivate.com/apis/wos-starter/v1/documents',
        ldap_apiurl: 'https://api.lib.kth.se/ldap/api/v1',
        orcid_apiurl: 'https://pub.orcid.org/v3.0/search',
        letaanstallda_apiurl: 'https://api.lib.kth.se/pi/v1',
        ldap_apikey: 'xxxxxxxxxxxxxxxxxxxxxxxx',
        orcid_apikey: '',
        letaanstallda_apikey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        scopus_apikey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        wos_apikey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    }

    var observer_config = {
        attributes: true,
        childList: true,
        characterData: true
    };
    var observer
    var diva_id
    var authortarget
    var diva_id_selector;
    var diva_observer_selector;
    var i = 0;
    var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();

    /**
     * Funktion för att sätta apinycklar
     *
     * @param {object} keys
     */
    function setapikeys(keys) {
        monkey_config.ldap_apikey = keys.apikeys.ldap;
        monkey_config.orcid_apikey = keys.apikeys.orcid;
        monkey_config.letaanstallda_apikey = keys.apikeys.letaanstallda;
        monkey_config.scopus_apikey = keys.apikeys.scopus;
        monkey_config.wos_apikey = keys.apikeys.wos;
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
                url: monkey_config.ldap_apiurl + '/divamonkey',
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
                        Cookies.set('token', response.token, {
                            expires: 30
                        })
                        setapikeys(response)
                        init(false);
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
     * Funktion för att logga in
     *
     */
    function monkeylogin() {
        var loginButton = $('#login');
        loginButton.click(function() {
            var username = $('#username').val() + "@ug.kth.se";
            var password = $('#password').val();
            $.ajax({
                type: 'POST',
                url: monkey_config.ldap_apiurl + '/login',
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
     * Hjälpfunktion för att skapa datum
     *
     * @param {*} i
     */
    function addZero(i) {
        if (i < 10) {
            i = "0" + i;
        }
        return i;
    }

    /**
     * Sorterar en array(exvis json response)
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
                let i = -1,
                    result = 0;
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
        $('#monkeytalk').html('Nu blev det fel!');
    }

    /**
     * Hämta info från ORCiD
     *
     * @param {*} fnamn
     * @param {*} enamn
     */
    async function getOrcid(fnamn, enamn) {
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med ORCiD. Det kan ta lite tid...");
        var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
        var url = monkey_config.orcid_apiurl + "?q=family-name:" + enamn2 + "+AND+given-names:" + fnamn2;
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'content-type': 'application/json;charset=utf-8'
            }
        })
        var orcidusers = [];
        var result = response.data.result;
        if (result) {
            for (i = 0; i < result.length; i++) {
                const orciddetails = await axios.get(
                    encodeURI("https://pub.orcid.org/v3.0/" + result[i]['orcid-identifier'].path), {
                        headers: {
                            'Accept': "application/json",
                            'content-type': 'application/json;charset=utf-8'
                        }
                    }
                );
                var orciddetailsresult = orciddetails.data;
                orcidusers.push(orciddetailsresult);
            }
        }
        var html = '<div><h2>Information från ORCiD</h2>';
        if (orcidusers) {
            var json = orcidusers
            $.each(json, function(key, value) {
                html += '<div class="inforecord flexbox column">';
                html += '<div>' +
                    '<span class="fieldtitle">Namn: </span>' +
                    '<span>' +
                    '<a target="_new" href="' + json[key]['orcid-identifier'].uri + '">' +
                    json[key].person.name['family-name'].value + " " + json[key].person.name['given-names'].value +
                    '</a>' +
                    '</span>' +
                    '</div>'
                html += '<div>' +
                    '<span class="fieldtitle">ORCiD: </span>' +
                    '<span>' +
                    json[key]['orcid-identifier'].path +
                    '</span>' +
                    '</div>'
                if (json[key]["activities-summary"].employments["affiliation-group"].length > 0) {
                    $.each(json[key]["activities-summary"].employments["affiliation-group"], function(empkey, empvalue) {
                        html += '<div>' +
                            '<span class="fieldtitle">Org: </span>' +
                            '<span>' +
                            json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"].organization.name +
                            '</span>' +
                            '</div>'
                        var date;
                        if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"]) {
                            if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].year) {
                                date = json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].year.value
                            }
                            if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].month) {
                                date += '-' + json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].month.value
                            }
                            if (json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].day) {
                                date += '-' + json[key]["activities-summary"].employments["affiliation-group"][empkey].summaries["0"]["employment-summary"]["start-date"].day.value
                            }
                            html += '<div>' +
                                '<span class="fieldtitle">Datum: </span>' +
                                '<span>' +
                                date +
                                '</span>' +
                                '</div>'
                        }
                    })
                }
                html += '</div>'
            });
        }
        html += '</div>'
        $("#monkeyresultswrapper i").css("display", "none");
        $('#monkeyresults').html(html);
        $("#monkeytalk").html("ORCiD svarade... se resultatet här nedanför");

    }

    /**
     * Hämta info från LDAP
     *
     * @param {*} fnamn
     * @param {*} enamn
     * @param {*} kthid
     */
    async function getLDAP(fnamn, enamn, kthid) {
        $("#monkeyresultswrapper_right i").css("display", "inline-block"); // visas i högermarginalen sen version 1.1.15
        $("#monkeytalk_right").html("Jag pratar med LDAP...");
        var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
        var url = monkey_config.ldap_apiurl + '/users/' +
            fnamn2 +
            '* ' +
            enamn2 +
            ' *' +
            '?token=' + monkey_config.ldap_apikey;

        if (kthid != "") {
            url = monkey_config.ldap_apiurl + '/kthid/' +
                kthid +
                '?token=' + monkey_config.ldap_apikey;
        }


        await axios.get(url)
            .then(function(response) {
                var html = '<div><div class="resultsheader">Information från KTH UG(LDAP)</div>';
                if (response.data) {
                    var json = response.data
                    if (response.status == 201) {
                        html += "<p>Inga användare hittades</p>";
                    } else {
                        //gå igenom alla users och lägg till i html
                        //Sortering
                        json.ugusers = sortByAttribute(json.ugusers, 'sn', 'givenName')
                        $.each(json.ugusers, function(key, value) {
                            html += '<div class="inforecord flexbox column">';
                            html += '<h2>kthid: ' + json.ugusers[key].ugKthid + '</h2>';
                            html += '<div><span class="fieldtitle">Efternamn: </span><span>' + json.ugusers[key].sn + '</span></div>' +
                                '<div><span class="fieldtitle">Förnamn: </span><span>' + json.ugusers[key].givenName + '</span></div>' +
                                //'<div><span class="fieldtitle">Kthid: </span><span>' + json.ugusers[key].ugKthid + '</span></div>' +
                                '<div><span class="fieldtitle">Titel: </span><span>' + json.ugusers[key].title + '</span></div>' +
                                '<div><span class="fieldtitle">Skola/org: </span><span>' + json.ugusers[key].kthPAGroupMembership + '</span></div>' +
                                '<div><span class="fieldtitle">KTH-affiliering: </span><span>' + json.ugusers[key].ugPrimaryAffiliation + '</span></div>' +
                                '<div><span class="fieldtitle">ORCiD: </span><span>' + json.ugusers[key].ugOrcid + '</span></div>' +
                                '<div><span class="fieldtitle">Email: </span><span>' + json.ugusers[key].mail + '</span></div>' +
                                '<div><span class="fieldtitle">Username: </span><span><a href="https://www.kth.se/profile/' + json.ugusers[key].ugUsername + '" target="_new">' + json.ugusers[key].ugUsername + '</a></span></div>'
                            html += '</div>';
                        });

                    }
                }

                html += '</div>'
                $("#monkeyresultswrapper_right i").css("display", "none");
                $('#monkeyresults_right').html(html);
                $("#monkeytalk_right").html("LDAP svarade... se resultatet här nedanför");
            })
            .catch(function(error) {
                api_error(error.response);
            })
            .then(function() {});
    }

    /**
     * Funktion för att normalisera namn
     * Świderski blir Swiderski
     */

    function normalizeName(str) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
    }

    /**
     * Hämta info från Leta anställda
     *
     * @param {*} fnamn
     * @param {*} enamn
     */

    function getLeta(fnamn, enamn) {
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med Leta anställda...");
        // Normalisera namn, ta bort accenter
        var fnamnNorm = normalizeName(fnamn);
        var enamnNorm = normalizeName(enamn);
        var fnamn2 = fnamnNorm.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamnNorm.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
        var enamn3 = enamn2.replace(/æ/g, "ae") // ersätt eventuella æ med ae i namnen före sökning. Leta KTH-anställda spricker annars
            console.log(enamn3);
        var url = monkey_config.letaanstallda_apiurl + "/users?fname=" +
            fnamn2 +
            "%&ename=" +
            enamn3 +
            "%" +
            "&api_key=" + monkey_config.letaanstallda_apikey;
        axios.get(url)
            .then(function(response) {
                var html = '<div><h2>Information från Leta anställda</h2>';
                if (response.data) {
                    var json = response.data
                    if (response.status == 201) {
                        html += "<p>Inga användare hittades</p>";
                    } else {
                        //gå igenom alla users och lägg till i html
                        $.each(json, function(key, value) {
                            html += "<p> Namn: " + json[key].Fnamn + " " + json[key].Enamn + "<br />" +
                                "KTH-ID: " + json[key].KTH_id + "<br />" +
                                "ORCiD: " + json[key].ORCIDid + "<br />" +
                                json[key].Bef_ben + ", " +
                                json[key].Orgnamn + ", " +
                                json[key].skola + "<br />" +
                                "Fr.o.m. " + json[key].Anst_nuv_bef + "<br />" +
                                "T.o.m. " + json[key].Bef_t_o_m + "<br />" +
                                "Uppdaterat: " + json[key].datum +
                                "</p>"
                        });
                    }
                }

                html += '</div>'
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyresults').html(html);
                $("#monkeytalk").html("Leta KTH-anställda svarade... se resultatet här nedanför");
            })
            .catch(function(error) {
                api_error(error.response);
            })
            .then(function() {});
    }

    /**
     * Hämta info från Scopus
     *
     * Scopus har slutat fungera pga CORS
     * Skriv om till GM_xmlhttpRequest
     * @param {*} doi
     */

    async function getScopus(doi) {
        if (doi == "") {
            $('#monkeytalk').html('Ojojoj, ingen DOI!');
            $("#monkeyresultswrapper i").css("display", "none");
            return 0;
        }
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med Scopus...");
        var url = monkey_config.scopus_api_url + "/" +
            doi +
            '?apiKey=' + monkey_config.scopus_apikey;
        await GM_xmlhttpRequest({
            method: "GET",
            url: url,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            onload: function(response) {
                var html = '<div><div class="updateheader"></div>';
                if (response.status == 201) {
                    html += "<p>Hittade inget i Scopus!</p>";
                } else {
                    var scopusjson = JSON.parse(response.responseText)
                        //hitta ScopusId

                    var eid = scopusjson['abstracts-retrieval-response']['coredata']['eid']; //plocka värdet för ScopusId (eid)
    /**
     * Uppdatera ScopusId, inte bara lägga till ifall fältet är tomt
     *
     * AW 2024-02-22
     */
    //                    if (eid == "" // om inget ScopusId hittas...
    //                        ||
    //                        typeof eid === 'undefined' ||
    //                        eid == 'undefined') {
    //                                      html += '<p>Inget ScopusID hittades</p>';
    //                  } else {
                    {
                        //                        if ($("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val() == "") {
                        html += '<p style="color:green;">Uppdaterat ScopusID: ' + eid + '</p>';
                        $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val(eid); // skriv in det i fältet för ScopusId
                        //                        }
                    }
    /**
     *
     * AW 2024-02-22
     */
                    var pmid = scopusjson['abstracts-retrieval-response']['coredata']['pubmed-id']; //plocka värdet för PubMedID (PMID
                    if (pmid == "" // uppdatera bara om fältet är tomt
                        ||
                        typeof pmid === 'undefined' ||
                        pmid == 'undefined') {
                        //                 html += '<p>PubMedID hittades inte i Scopus</p>';
                    } else {
                        if ($("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val() == "") {
                            html += '<p style="color:green;">Uppdaterat PubMedID: ' + pmid + '</p>';
                            $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
                        }
                    }

                    var oa = scopusjson['abstracts-retrieval-response']['coredata']['openaccessFlag']; // plocka openaccessFlag true or false
                    if (oa == 'true') { // kolla om artikeln är OA
                        document.getElementById(diva_id + ":doiFree").checked = true; // checka boxen
                        html += '<p style="color:green;">Uppdaterat Free full-text: ' + scopusjson['abstracts-retrieval-response']['coredata']['openaccessFlag'] + '</p>'; // visa bara uppdatering om Free full-text = 'true'
                    } else {
                        ""; // checka inte boxen
                    }
                }
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyupdates').html(html + $('#monkeyupdates').html());
                $("#monkeytalk").html("Titta här nedanför för att se om jag uppdaterat något.");
                return 1;
            },
            onerror: function(error) {
                $("#monkeyresultswrapper i").css("display", "none");
                $("#monkeytalk").html("Jag hittade inget i Scopus!");
            }
        });
    }

    /**
     * Hämta info från Web of Science
     *
     * @param {*} doi
     */

    async function getWoS(doi) {
        var pmid = "";
        var isi = "";
        if (doi == "") {
            $('#monkeytalk').html('Ojojoj, ingen DOI! Jag behöver en DOI för att kunna uppdatera från databaserna.');
            $("#monkeyresultswrapper i").css("display", "none");
            return 0;
        }
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med Web of Science...");
        var url = monkey_config.wos_api_url + '?q=DO=' + doi;

        //använd GM_xmlhttpRequest för anrop som annars inte fungerar pga CORS
        await GM_xmlhttpRequest({
            method: "GET",
            url: url,
            headers: {
                "application": "application/json",
                "X-ApiKey": monkey_config.wos_apikey
            },
            onload: function(response) {
                var html = '<div><div class="updateheader"></div>';
                if (response.status == 201) {
                    html += "<p>Hittade inget i Web of Science</p>";
                } else {
                    response = JSON.parse(response.response).hits
                    if (response.length !== 0) {
                        isi = response[0].uid.split("WOS:")[1]
                    }

                    if (isi == "" // uppdatera bara om fältet är tomt
                        ||
                        typeof isi === 'undefined' ||
                        isi == 'undefined') {
                        //                 html += '<p>ISI hittades inte</p>';
                    } else {
                        if ($("div.diva2addtextchoicecol:contains('ISI')").parent().find('input').val() == "") {
                            html += '<p style="color:green;">Uppdaterat ISI: ' + isi + '</p>';
                            $("div.diva2addtextchoicecol:contains('ISI')").parent().find('input').val(isi); // skriv in värdet för ISI/UT i fältet för ISI
                        }
                    }
                };
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyupdates').html(html + $('#monkeyupdates').html());
                $("#monkeytalk").html("Titta här nedanför för att se om jag uppdaterat något.");
            },
            onerror: function(error) {
                $("#monkeyresultswrapper i").css("display", "none");
                $("#monkeytalk").html("Jag hittade inget i Web of Science");
            }
        });
    }

    /**
     * Funktion för att anropa DiVA och hämta information via "search"
     *
     * @param {string} titleAll
     * @param {string} format (csl_json=json, mods=xml)
     */

    async function getDiVA(titleAll, format) {
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med DiVA...");
        var url = monkey_config.diva_search_api_url + '?format=' + format + '&addFilename=true&aq=[[{"titleAll":"' +
            titleAll.replace("?", "") + '"}]]&aqe=[]&aq2=[[]]&onlyFullText=false&noOfRows=50&sortOrder=title_sort_asc&sortOrder2=title_sort_asc'; // av någon anledning fixar inte sökningen titlar som innehåller eller i alla fall slutar med ett "?"
        await axios.get(url)
            .then(function(response) {
                var html = '<div><div class="resultsheader">Information från DiVA, Söktext: ' + '<br /><br />' + titleAll + '</div>';
                if (response.data) {
                    var json = response.data
                    if ($(response.data).find('mods').length == 0) {
                        html += '<div><span class="fieldtitle"><br /><p style="color:green;">Jag hittade ingenting!<br />Det finns sannolikt ingen dubblett!</p></span></div></div>';
                    } else {
                        $(response.data).find('mods').each(function(i, j) {
                            html += '<div class="inforecord flexbox column">';
                            html += '<h2><p style="color:red;">ID: ' + $(j).find('recordIdentifier').text() + '</p></h2>';
                            html += '<div><span class="fieldtitle">Status (artiklar): </span><span>' + $(j).find('note[type="publicationStatus"]').text() + '</span></div>' +
                                '<div><span class="fieldtitle">URI: </span><span><a href="' + $(j).find('identifier[type="uri"]').text() + '" target="_blank">' + $(j).find('identifier[type="uri"]').text() + '</a></span></div>' +
                                //   '<div><span class="fieldtitle">Publiceringsstatus<br/>(artiklar): </span><span>' + $(j).find('note[type="publicationStatus"]').text() + '</span></div>' +
                                '<div><span class="fieldtitle">Publikationstyp: </span><span>' + $(j).find('genre[authority="diva"][type="publicationType"][lang="swe"]').text() + '</span></div>' +
                              //  '<div><span class="fieldtitle">DOI: </span><span>' + $(j).find('identifier[type="doi"]').text() + '</span></div>' +
                                '<div><span class="fieldtitle">DOI: </span><span><a href="https://doi.org/' + $(j).find('identifier[type="doi"]').text() + '" target="_blank">' + $(j).find('identifier[type="doi"]').text() + '</a></span></div>' +
                              //  '<div><span class="fieldtitle">ISI: </span><span>' + $(j).find('identifier[type="isi"]').text() + '</span></div>' +
                                '<div><span class="fieldtitle">ISI: </span><span><a href="https://gateway.webofknowledge.com/api/gateway?SrcApp=sfx&KeyUT=' + $(j).find('identifier[type="isi"]').text() + '&DestLinkType=FullRecord&SrcAuth=Name&DestApp=WOS&GWVersion=2" target="_blank">' + $(j).find('identifier[type="isi"]').text() + '</a></span></div>' +
                              //  '<div><span class="fieldtitle">ScopusID: </span><span>' + $(j).find('identifier[type="scopus"]').text() + '</span></div>' +
                                '<div><span class="fieldtitle">ScopusID: </span><span><a href="http://www.scopus.com/record/display.url?origin=inward&partnerID=40&eid=' + $(j).find('identifier[type="scopus"]').text() + '" target="_blank">' + $(j).find('identifier[type="scopus"]').text() + '</a></span></div>' +
                              //  '<div><span class="fieldtitle">PMID: </span><span>' + $(j).find('identifier[type="pmid"]').text() + '</span></div>' +
                                '<div><span class="fieldtitle">PMID: </span><span><a href="https://www.ncbi.nlm.nih.gov/pubmed/' + $(j).find('identifier[type="pmid"]').text() + '" target="_blank">' + $(j).find('identifier[type="pmid"]').text() + '</a></span></div>' +
                                //                            '<div><span class="fieldtitle">Created: </span><span>' + $(j).find('recordCreationDate').text() + '</span></div>' +
                                //                            '<div><span class="fieldtitle">Changed: </span><span>' + $(j).find('recordChangeDate').text() + '</span></div>' +
                                //                            '<div><span class="fieldtitle">Origin: </span><span>' + $(j).find('recordOrigin').text() + '</span></div>' +
                                //                            '<div><span class="fieldtitle">Source: </span><span>' + $(j).find('recordContentSource').text() + '</span></div>' +
                                '<div><span class="fieldtitle"><img class="oa" src="' + monkey_config.oa_image_url + '"> Publicerad version: </span><span><a href="' + $(j).find('url[displayLabel="fulltext:print"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext:print"]').text() + '</p>' + '</a></span></div>' +
                                '<div><span class="fieldtitle"><img class="oa" src="' + monkey_config.oa_image_url + '"> Preprint: </span><span><a href="' + $(j).find('url[displayLabel="fulltext:preprint"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext:preprint"]').text() + '</p>' + '</a></span></div>' +
                                '<div><span class="fieldtitle"><img class="oa" src="' + monkey_config.oa_image_url + '"> Postprint: </span><span><a href="' + $(j).find('url[displayLabel="fulltext:postprint"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext:postprint"]').text() + '</p>' + '</a></span></div>' +
                                '<div><span class="fieldtitle"><img class="oa" src="' + monkey_config.oa_image_url + '"> Ospec: </span><span><a href="' + $(j).find('url[displayLabel="fulltext"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext"]').text() + '</p>' + '</a></span></div>' +
                                '<div><span class="fieldtitle">Förlag: </span><span>' + $(j).find('publisher').text() + '</span></div>' +
                                '<div><span class="fieldtitle">År: </span><span>' + $(j).find('dateIssued').text() + '</span></div>' +
                                '<div><span class="fieldtitle">Note: </span><span>' + $(j).find('note').text() + '</span></div>'
                            html += '</div>';
                        });
                        /*
                        $.each(response.data, function(key, value) {
                            html += '<p>Status: ' + response.data[key].status + '</p>' +
                                '<p>ID: ' + response.data[key].id + '</p>' +
                                '<p>Note: ' + response.data[key].note + '</p>' +
                                '<p>DOI: ' + response.data[key].DOI + '</p>' +
                                '<p>ScopusId: ' + response.data[key].ScopusId + '</p>' +
                                '<p>Created: ' + response.data[key].created[0].raw + '</p>' +
                                '<p>Updated: ' + response.data[key].updated[0].raw + '</p>' +
                                '</br>'
                        });
                        */
                    }
                }

                html += '</div>'
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyresults').html(html);
                $("#monkeytalk").html("DiVA svarade... se resultatet här nedanför");
            })
            .catch(function(error) {
                $("#monkeyresultswrapper i").css("display", "none");
                $("#monkeytalk").html("Jag hittade inget i DiVA");
            })
            .then(function() {});
    }

    /**
     * Funktion för att anropa DBLP och hämta information via DOI
     *
     * @param {string} doi
     */

    function getDblp(doi) {
        if (doi == "") {
            $('#monkeyresults').html('DBLP: Ingen DOI finns!');
            $("#monkeyresultswrapper i").css("display", "none");
            return;
        }
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med DBLP...");
        var url = monkey_config.dblp_api_doi_url + "/" + doi;
        axios.get(url)
            .then(function(response) {
                var html = '<div><div class="resultsheader">Information från dblp, DOI: ' + doi + '</div>';
                if ($(response.data).find("crossref").text()) {
                    var url = monkey_config.dblp_api_rec_url + "/" + $(response.data).find("crossref").text();
                    axios.get(url)
                        .then(function(response) {
                            //                    html += '<div class="inforecord flexbox column">';
                            html += '<br /><div style="color:green;"><span class="fieldtitle">Title: </span><span>' + $(response.data).find("title").text() + '</span></div>' +
                                '<br /><div style="color:green;"><span class="fieldtitle">Series: </span><span>' + $(response.data).find("series").text() + '</span></div>' +
                                '<br /><div style="color:green;"><span class="fieldtitle">Volume: </span><span>' + $(response.data).find("volume").text() + '</span></div>'
                            html += '</div>';
                            $("#monkeyresultswrapper i").css("display", "none");
                            $('#monkeyresults').html(html);
                            $("#monkeytalk").html("dblp svarade... se resultatet här nedanför!");
                        })
                        .catch(function(error) {
                            api_error(error.response);
                        })
                        .then(function() {});
                } else {
                    html += "<p>Hittade inget hos dblp</p>";
                }
            })
            .catch(function(error) {
                $('#monkeyresults').html('');
                $("#monkeyresultswrapper i").css("display", "none");
                $("#monkeytalk").html("Nej, jag hittade inget i dblp. Det kanske inte är ett konferensbidrag inom Computer Science?");
            })
            .then(function() {});
    }

    /**
     * Funktion för att anropa Crossref och hämta information via DOI
     *
     * @param {string} doi
     */

    function getCrossref(doi) {
        //          var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
        if (doi != "") {
            $("#monkeyresultswrapper i").css("display", "inline-block");
            $("#monkeytalk").html("Jag pratar med Crossref...");
            var url = 'https://api.crossref.org/works/' + doi + '/transform/application/vnd.crossref.unixsd+xml';
            axios.get(url)
                .then(function(response) {
                    var publisher = $(response.data).find('crm-item[name="publisher-name"]').text(); // hämtar förlagsinformation
                    var publisher_edited = publisher.replace(/Springer Science and Business Media LLC/g, "Springer Nature");
                    $("div.diva2addtextchoicecol:contains('Annat förlag') , div.diva2addtextchoicecol:contains('Other publisher')").parent().find('input').val(publisher_edited); // klistrar in förlagsinfo från Crossref
                    $("#monkeyresultswrapper i").css("display", "none");
                    $('#monkeyupdates').html('<p style="color:green;">Uppdaterat Förlag: ' + publisher_edited + '</p>' + $('#monkeyupdates').html());
                    $('#monkeyresults').html();
                    $("#monkeytalk").html("Crossref svarade... se resultatet under \"Annat förlag\" i posten!");
                })
                .catch(function(error) {
                    $('#monkeyresults').html('');
                    $("#monkeyresultswrapper i").css("display", "none");
                    $("#monkeytalk").html("Nej, jag hittade inget i Crossref");
                })
                .then(function() {});
        }
    }


    /**
     * Funktion för att anropa Crossref och volume/issue/pages via DOI
     *
     * @param {string} doi
     */

    function getCrossrefVol(doi) {
        //          var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
        if (doi != "") {
            $("#monkeyresultswrapper i").css("display", "inline-block");
            $("#monkeytalk").html("Jag pratar med Crossref...");
            var url = 'https://api.crossref.org/works/' + doi + '/transform/application/vnd.crossref.unixsd+xml';
            axios.get(url)
                .then(function(response) {
                    var year = $(response.data).find('journal_issue').find('publication_date').find('year').last().text(); // hämtar year, svårt här, ibland två st year - tar det sista
                    var volume = $(response.data).find('journal_volume').find('volume').text(); // hämtar volume
                    var issue = $(response.data).find('journal_issue').find('issue').text(); // hämtar issue
                    var first_page = $(response.data).find('journal_article').find('pages').find('first_page').text(); // hämtar första sidan
                    var last_page = $(response.data).find('journal_article').find('pages').find('last_page').text(); // hämtar sista sidan
                    var isbn = $(response.data).find('proceedings_metadata').find('isbn').text(); // hämtar isbn (finns det flera...?)

                    if ($(response.data).find('journal_issue').find('publication_date').find('year').text() != "") { // om det inte finns några uppgifter hos Crossref klistras inget in
                        $("div.diva2addtextchoicecol:contains('Year:') , div.diva2addtextchoicecol:contains('År:')").next().find('input').val(year); // klistrar in år från Crossref
                    }
                    if ($(response.data).find('journal_volume').find('volume').text() != "") { // om det inte finns några uppgifter hos Crossref klistras inget in
                        $("div.diva2addtextchoicecol:contains('Volume:') , div.diva2addtextchoicecol:contains('Volym:')").next().find('input').val(volume); // klistrar in volym från Crossref
                    }
                    if ($(response.data).find('journal_issue').find('issue').text() != "") { // om det inte finns några uppgifter hos Crossref klistras inget in
                        $("div.diva2addtextchoicecol:contains('Number:') , div.diva2addtextchoicecol:contains('Nummer:')").next().find('input').val(issue); // klistrar in nummer från Crossref
                    }
                    if ($(response.data).find('journal_article').find('pages').find('first_page').text() != "") { // om det inte finns några uppgifter hos Crossref klistras inget in
                        $("div.diva2addtextchoicecol:contains('Pages:') , div.diva2addtextchoicecol:contains('Sidor:')").next().find('input').first().val(first_page); // klistrar in första sidan från Crossref
                    }
                    if ($(response.data).find('journal_article').find('pages').find('last_page').text() != "") { // om det inte finns några uppgifter hos Crossref klistras inget in
                        $("div.diva2addtextchoicecol:contains('Pages:') , div.diva2addtextchoicecol:contains('Sidor:')").next().find('input').next().val(last_page); // klistrar in första sidan från Crossref
                    }
                    if ($(response.data).find('proceedings_metadata').find('isbn').text() != "") { // om det inte finns några uppgifter hos Crossref klistras inget in
                        $("div.diva2addtextchoicecol:contains('ISBN')").next().find('input').val(isbn); // klistrar in isbn från Crossref FUNKAR BARA OM MAN KLICKAR TVÅ GGR PÅ KNAPPEN ARGH!!
                    }
                    $("#monkeyresultswrapper i").css("display", "none");
                    $('#monkeyresults').html();
                    $("#monkeytalk").html("Crossref svarade... se resultatet under År/Volym/nummer i posten!");
                })
                .catch(function(error) {
                    $('#monkeyresults').html('');
                    $("#monkeyresultswrapper i").css("display", "none");
                    $("#monkeytalk").html("Nej, jag hittade inget i Crossref");

                })
                .then(function() {});
        }
    }

    /**
     * Snott från Malmö:
     * Funktion för att anropa Crossref och hämta abstract via DOI - kopplad till knapp vid abstract.
     *
     * @param {string} doi
     *mau
     */
function getCrossrefAbs(doi) {
        //          var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
        if (doi != "") {

            $("#monkeyresultswrapper i").css("display", "inline-block");
            $("#monkeytalk").html("Jag pratar med Crossref...");
            var url = 'https://api.crossref.org/works/' + doi + '/transform/application/vnd.crossref.unixsd+xml';
            axios.get(url)
                .then(function(response) {
                    var abs = $(response.data).find('jats\\:abstract').find('jats\\:p').text(); //hämtar abstract
                    var abs2 = $(response.data).find('jats\\:abstract'); //om abstract i sektioner
               //  Initialize an empty string to store the concatenated text
                        var abstract = "";
                        // Iterate through each jats:p element within the jats:abstract
                        abs2.find('jats\\:p').each(function() {
                        // Get the paragraph text
                        var paragraph = $(this).text();
                        // Concatenate the title and paragraph with formating
                        abstract += '<p>' + paragraph + '</p>';
                         });
                        // Trim any extra whitespace at the end
                       abstract = abstract.trim();
                // Initialize an empty string to store the concatenated text
                        var concAbs = "";
                        // Iterate through each jats:sec element within the jats:abstract
                        abs2.find('jats\\:sec').each(function() {
                        // Get the title and paragraph text
                        var title = $(this).find('jats\\:title').text();
                        var paragraph = $(this).find('jats\\:p').text();
                        // Concatenate the title and paragraph with formating
                        concAbs += '<p><strong>'+ title + ':</strong> ' + paragraph + '</p>';
                         });
                        // Trim any extra whitespace at the end
                       concAbs = concAbs.trim();

                if (concAbs) { // && ($("div.diva2addtextchoicebr:contains('Abstract')").parent().parent().find('iframe').first().contents().find("body").html().trim()==="" || $("div.diva2addtextchoicebr:contains('Abstract')").parent().parent().find('iframe').first().contents().find("body").html().trim()==="<p><br></p>")) { //om abstract i sektioner i crossref men inget abstract i DiVA
                    $("div.diva2addtextchoicebr:contains('Abstract')").parent().parent().find('iframe').first().contents().find("body").html(concAbs); //klistrar in abstract från crossref
                    $('#monkeyupdates').html('<p style="color:green;">Lagt till abstract</p>' + $('#monkeyupdates').html());
                    }
                if (!concAbs && abstract) { // && ($("div.diva2addtextchoicebr:contains('Abstract')").parent().parent().find('iframe').first().contents().find("body").html().trim()==="" || $("div.diva2addtextchoicebr:contains('Abstract')").parent().parent().find('iframe').first().contents().find("body").html().trim()==="<p><br></p>")) { //om abstract i crossref men inte i DiVA
                   $("div.diva2addtextchoicebr:contains('Abstract')").parent().parent().find('iframe').first().contents().find("body").html(abstract); //klistrar in abstract från crossref
                   $('#monkeyupdates').html('<p style="color:green;">Lagt till abstract</p>' + $('#monkeyupdates').html());
                   }
                    $("#monkeyresultswrapper i").css("display", "none");
                    $('#monkeyresults').html();
                    $("#monkeytalk").html("Crossref svarade... se resultatet under Abstract i posten!");
                })
                .catch(function(error) {
                    $('#monkeyresults').html('');
                    $("#monkeyresultswrapper i").css("display", "none");
                    $("#monkeytalk").html("Nej, jag hittade inget i Crossref");
                })
                .then(function() {});
        }
    }

    /**
     *
     * Funktion för att bevaka uppdateringar i noden som författarna ligger i
     * Sker t ex efter "Koppla personpost"
     * Initiera apan på nytt.
     * @param {*} mutations
     */

    function mutationCallback(mutations) {
        mutations.forEach(function(mutation) {
            var newNodes = mutation.addedNodes;
            if (newNodes !== null) {
                init(true);
                var $nodes = $(newNodes);
                $nodes.each(function() {
                    var $node = $(this);
                    if ($node.prop("id") == diva_id + ':authorSerie') {
                        console.log('author uppdaterad')
                    }
                });
            }
        });
    };

    /**
     * Funktion för att initiera Apan
     *
     */
    async function init(re_init) {

        ///////////////////////////////////////////////////////////
        //
        // Skapa en DiVA-knapp överst
        //
        ///////////////////////////////////////////////////////////

        $('#DiVAButtonjq').remove();
        var DiVAButtonjq = $('<button id="DiVAButtonjq" type="button">Sök i DiVA</button>');
        var $maintitleiframe;
        $maintitleiframe = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first();
        DiVAButtonjq.on("click", function() {
            getDiVA($maintitleiframe.contents().find("body").html().replace(/&nbsp;/g, " ").replace(/\?/g, "").replace(/&amp;/g, "?"), 'mods'); // ta bort saker som innehåller "&" och "?" som sökningen inte klarar av
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
        var s_title = $("div.diva2addtextchoicebr:contains('Titel'), div.diva2addtextchoicebr:contains('Title')").not($("div.diva2addtextchoicebr:contains('Alternativ'), div.diva2addtextchoicebr:contains('Alternative'), div.diva2addtextchoicebr:contains('Titel: Handledarens'), div.diva2addtextchoicebr:contains('Title: The supervisor'), div.diva2addtextchoicebr:contains('Titel: Ange opponentens'), div.diva2addtextchoicebr:contains('Title: The opponent'), div.diva2addtextchoicebr:contains('Titel: Ange examinatorns'), div.diva2addtextchoicebr:contains('Title: The examiner')"))
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
        var c_title = $("div.diva2addtextchoicebr:contains('Titel'), div.diva2addtextchoicebr:contains('Title')").not($("div.diva2addtextchoicebr:contains('Alternativ'), div.diva2addtextchoicebr:contains('Alternative'), div.diva2addtextchoicebr:contains('Titel: Handledarens'), div.diva2addtextchoicebr:contains('Title: The supervisor'), div.diva2addtextchoicebr:contains('Titel: Ange opponentens'), div.diva2addtextchoicebr:contains('Title: The opponent'), div.diva2addtextchoicebr:contains('Titel: Ange examinatorns'), div.diva2addtextchoicebr:contains('Title: The examiner')"))
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
        // Skapa en knapp vid titelfältet för böcker,
        // att ändra versaler till gemener förutom första bokstaven
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

        var $altmaintitleiframe = $("div.diva2addtextchoice2:contains('Alternativ titel') , div.diva2addtextchoice2:contains('Alternative title')").parent().next().find('iframe').first();
        var $altsubtitleiframe = $("div.diva2addtextchoice2:contains('Alternativ titel') , div.diva2addtextchoice2:contains('Alternative title')").parent().next().next().next().find('iframe').first();
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
        $("div.diva2addtextchoice2:contains('Alternativ titel'), div.diva2addtextchoice2:contains('Alternative title')").parent().before(alttitlesplitButtonjq)

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

        ////////////////////////////////////
        //
        // Knappar vid "Annan serie"/"Other series" - ISSN
        //
        ////////////////////////////////////

        if ($("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(0).val() != "") { // ingen mening att visa knappar om det inte står något i fältet
            $('#issnTitleButtonjq').remove();
            var issnTitleButtonjq = $('<button class="link" id="issnTitleButtonjq" type="button">Öppna i ISSN Portal på serietitel</button>');
            issnTitleButtonjq.on("click", function() {
                var url = "https://portal.issn.org/api/search?search[]=MUST=default=" +
                    $("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(0).val() +
                    "";
                window.open(url, '_blank');
            })
        } else {}
        $("div.diva2addtextchoicecol:contains('Title of series:'), div.diva2addtextchoicecol:contains('Seriens namn:')").before(issnTitleButtonjq)

        if ($("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(1).val() != "") { // ingen mening att visa knappar om det inte står något i fältet
            $('#issnButtonjq').remove();
            var issnButtonjq = $('<button class="link" id="issnButtonjq" type="button">Öppna i ISSN Portal på ISSN</button>');
            issnButtonjq.on("click", function() {
                var url = "https://portal.issn.org/api/search?search[]=SHOULD=allissnbis=%22" +
                    $("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(1).val() + "%22" +
                    "&search[]=SHOULD=allissnbis=%22" + $("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(2).val() +
                    "%22";
                window.open(url, '_blank');
            })
        } else {}
        $("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(0).after(issnButtonjq)

        ///////////////////////////////////////////////////////////////
        //
        // Knappar vid ISBN-fälten
        // Ta bort bindestreck på fel ställen så att posten
        // går att spara utan felmeddelande
        //
        // öppna post i WorldCat
        //
        ///////////////////////////////////////////////////////////////

        i = 0;
        $("div.diva2addtextchoicecol:contains('ISBN')").each(function() {
            var thiz = this;

            $('#isbnHyphenButtonjq' + i).remove();
            var isbnHyphenButtonjq = $('<button id="isbnHyphenButtonjq' + i + '" type="button">X -</button>');
            isbnHyphenButtonjq.on("click", function() {
                var isbn = $(thiz).next().find('input').val();
                var altisbn = isbn.replace(/-/g, "");
                $(thiz).next().find('input').val(altisbn);
                $(thiz).next().find('input').focus();
                $(this).focus();
            })

            $('#openWorldCatButtonjq' + i).remove();
            var openWorldCatButtonjq = $('<button class="link" id="openWorldCatButtonjq' + i + '" type="button">Öppna i WorldCat</button>');
            openWorldCatButtonjq.on("click", function() {
                var url = "http://www.worldcat.org/isbn/" +
                    $(thiz).next().find('input').val() +
                    "";
                window.open(url, '_blank');
            })

            //wrapper för layout.
            var html = $('<div id="monkeyisbn' + i + '" style="width: 100%;float: left"></div>');
            html.append(isbnHyphenButtonjq)
            html.append(openWorldCatButtonjq)
            $(this).before(html)

            i++;
        });

        ////////////////////////////////////////
        //
        // WoS-knappar vid ISI-fältet
        //
        ////////////////////////////////////////
        if (monkey_config.wos) {
            $('#WoSButtonjq').remove();
            var WoSButtonjq = $('<button class="link" id="WoSButtonjq" type="button">Öppna i WoS</button>');
            WoSButtonjq.on("click", function() {
                var url = "https://focus.lib.kth.se/login?url=http://gateway.isiknowledge.com/gateway/Gateway.cgi?SrcApp=sfx&KeyUT=" +
                    $("div.diva2addtextchoicecol:contains('ISI')").parent().find('input').val() +
                    "&DestLinkType=FullRecord&SrcAuth=Name&DestApp=WOS&GWVersion=2";
                window.open(url, '_blank');
            })
            $("div.diva2addtextchoicecol:contains('ISI')").before(WoSButtonjq)

            $('#wosapiButtonjq').remove();
            var wosapiButtonjq = $('<button id="wosapiButtonjq" type="button" class="buttonload"><i class="fa fa-spinner fa-spin"></i>Uppdatera från WoS</button>');
            wosapiButtonjq.on("mousedown", async function() {
                event.preventDefault(); // Förhindra onblur
                getWoS($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
            })
            $("div.diva2addtextchoicecol:contains('ISI')").before(wosapiButtonjq)
        }

        ////////////////////////////////////
        //
        // Sökning på ScopusId i Scopus webbgränssnitt
        //
        ////////////////////////////////////
        $('#openScopusButtonjq').remove();
        var openScopusButtonjq = $('<button class="link" id="openScopusButtonjq" type="button">Öppna i Scopus</button>');
        openScopusButtonjq.on("click", function() {
            var url = "https://focus.lib.kth.se/login?url=https://www.scopus.com/record/display.url?origin=inward&partnerID=40&eid=" +
                $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val() +
                "";
            window.open(url, '_blank');
        })
        $("div.diva2addtextchoicecol:contains('ScopusID')").before(openScopusButtonjq)

        ////////////////////////////////////
        //
        // Sökning på titel i Crossref för att hitta DOI - experimentellt!
        //
        ////////////////////////////////////

        if ($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val() == "") { // bara om det saknas en DOI
            $('#titleCrossrefButtonjq').remove();
            var titleCrossrefButtonjq = $('<button class="link" id="titleCrossrefButtonjq" type="button">##Sök i Crossref på titel för att hitta DOI##</button>');
            titleCrossrefButtonjq.on("click", function() {
                var title = $("div.diva2addtextchoicebr:contains('Title'), div.diva2addtextchoicebr:contains('Titel')").parent().find('textarea').eq(0).val();
                //       var newtitle = title.replace("?", "") // av någon anledning fixar inte sökningen titlar som innehåller eller i alla fall slutar med ett "?"
                var url = "https://search.crossref.org/?q=" +
                    title;
                window.open(url, '_blank');
            })
            $("div.diva2addtextchoicecol:contains('DOI')").before(titleCrossrefButtonjq)
        }
        ////////////////////////////////////
        //
        // Sökning på titel i SemanticScholar för att hitta DOI - experimentellt!
        //
        ////////////////////////////////////

        if ($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val() == "") { // bara om det saknas en DOI
            $('#titleSemanticScholarButtonjq').remove();
            var titleSemanticScholarButtonjq = $('<button class="link" id="titleSemanticScholarButtonjq" type="button">##Sök i SemanticScholar på titel för att hitta DOI##</button>');
            titleSemanticScholarButtonjq.on("click", function() {
                var title = $("div.diva2addtextchoicebr:contains('Title'), div.diva2addtextchoicebr:contains('Titel')").parent().find('textarea').eq(0).val();
                //       var newtitle = title.replace("?", "") // av någon anledning fixar inte sökningen titlar som innehåller eller i alla fall slutar med ett "?"
                var url = "https://www.semanticscholar.org/search?q=" +
                    title;
                window.open(url, '_blank');
            })
            $("div.diva2addtextchoicecol:contains('DOI')").before(titleSemanticScholarButtonjq)
        }
        ////////////////////////////////////
        //
        // Uppdatera fält från Scopus
        //
        ////////////////////////////////////
        if (monkey_config.scopus) {
            $('#scopusButtonjq').remove();
            var scopusButtonjq = $('<button id="scopusButtonjq" type="button">Uppdatera från Scopus</button>');
            scopusButtonjq.on("mousedown", async function() {
                event.preventDefault(); // Förhindra onblur
                getScopus($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
            })
            $("div.diva2addtextchoicecol:contains('ScopusID')").before(scopusButtonjq)
        }
        ////////////////////////////////////
        //
        // Uppdatera förlagsfält från Crossref
        //
        ////////////////////////////////////


        if (doi != "") { // bara om det finns en DOI, annars är det meningslöst
            $('#crossrefButtonjq').remove();
            var crossrefButtonjq = $('<button id="crossrefButtonjq" type="button">Uppdatera förlag från Crossref</button>');
            crossrefButtonjq.on("mousedown", async function() {
               event.preventDefault(); // Förhindra onblur
               getCrossref($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
            })
            $("div.diva2addtextchoicecol:contains('Annat förlag') , div.diva2addtextchoicecol:contains('Other publisher')").before(crossrefButtonjq);
            //  $("div.diva2addtextchoicecol:contains('Annat förlag') , div.diva2addtextchoicecol:contains('Other publisher') , div.diva2addtextchoicecol:contains('Namn på utgivare') , div.diva2addtextchoicecol:contains('Name of publisher')").before(crossrefButtonjq);
        }

        ////////////////////////////////////
        //
        // Knapp för att uppdatera volume/issue/pages från Crossref
        //
        ////////////////////////////////////

        if (doi != "") { // bara om det finns en DOI, annars är det meningslöst
            $('#crossrefVolButtonjq').remove();
            var crossrefVolButtonjq = $('<button id="crossrefVolButtonjq" type="button">Uppdatera detaljer från Crossref</button>');
            crossrefVolButtonjq.on("mousedown", async function() {
                event.preventDefault(); // Förhindra onblur
                getCrossrefVol($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
            })
            $("div.diva2addtextchoice2:contains('Övriga uppgifter') , div.diva2addtextchoice2:contains('Other information') ").parent().before(crossrefVolButtonjq);
        }

        ////////////////////////////////////
        // Snott från Malmö
        // Knapp för att uppdatera abstract från Crossref
        // *mau
        ////////////////////////////////////


        if (doi != "") { // bara om det finns en DOI, annars är det meningslöst
            $('#crossrefAbsButtonjq').remove();
            var crossrefAbsButtonjq = $('<button id="crossrefAbsButtonjq" type="button">Uppdatera abstract från Crossref</button>');
            crossrefAbsButtonjq.on("mousedown", async function() {
                event.preventDefault(); // Förhindra onblur
                getCrossrefAbs($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
           })
                $("div.diva2addtextchoicebr:contains('Abstract')").parent().before(crossrefAbsButtonjq);
            }

        ///////////////////////////////////////////////////
        //  Knappar för att kolla i Crossrefs API JSON + XML
        //  samt även OpenAlex JSON API
        //////////////////////////////////////////////////


        if (doi != "") { // bara om det finns en DOI, annars är det meningslöst
            $('#crossrefJsonApiButtonjq').remove();
            var crossrefJsonApiButtonjq = $('<button class="link" id="crossrefJsonApiButtonjq" type="button">Crossref API JSON</button>');
            crossrefJsonApiButtonjq.on("mousedown", async function() {
                event.preventDefault(); // Förhindra onblur
                var url = "https://api.crossref.org/works/" +
                $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
                window.open(url, '_blank');
           })
                $("div.diva2addtextchoicecol:contains('DOI')").parent().before(crossrefJsonApiButtonjq);
            }

        if (doi != "") { // bara om det finns en DOI, annars är det meningslöst
            $('#crossrefXmlApiButtonjq').remove();
            var crossrefXmlApiButtonjq = $('<button class="link" id="crossrefXmlApiButtonjq" type="button">Crossref API XML</button>');
            crossrefXmlApiButtonjq.on("mousedown", async function() {
                event.preventDefault(); // Förhindra onblur
                var url = "https://doi.crossref.org/servlet/query?pid=biblioteket@kth.se&format=unixref&id=" +
                $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
                window.open(url, '_blank');
           })
                $("div.diva2addtextchoicecol:contains('DOI')").parent().before(crossrefXmlApiButtonjq);
            }

        if (doi != "") { // bara om det finns en DOI, annars är det meningslöst
            $('#openAlexJsonApiButtonjq ').remove();
            var openAlexJsonApiButtonjq = $('<button class="link" id="copenAlexJsonApiButtonjq " type="button">OpenAlex API JSON</button>');
            openAlexJsonApiButtonjq .on("mousedown", async function() {
                event.preventDefault(); // Förhindra onblur
                var url = "https://api.openalex.org/works/https://doi.org/" +
                $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
                window.open(url, '_blank');
           })
                $("div.diva2addtextchoicecol:contains('DOI')").parent().before(openAlexJsonApiButtonjq);
            }
        ///////////////////////////////////////////////////
        //
        /*  Klassificering från Swepub finns integrerad i DiVA nu = kan tas bort (även om jag tycker att den rosa knappen är snyggare)  2021-02-24 /Anders W
        //
        // Knapp för att kolla klassificering från Swepub
        //
        ///////////////////////////////////////////////////

        $('#classButtonjq').remove();
        var classButtonjq = $('<button id="classButtonjq" type="button">Klassifikation från Swepub</button>');
        classButtonjq.on("click", function() {
            var title = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first().contents().find("body").html();
            var keywords = $("div.diva2addtextchoicebr:contains('Nyckelord') , div.diva2addtextchoicebr:contains('Keywords')").parent().find('input').val()
            var abstract = $("div.diva2addtextchoicebr:contains('Abstract')").parent().parent().find('iframe').first().contents().find("body").html().replace(/<p>/g, "").replace(/<\/p>/g, "");
            $.ajax({
                url: 'https://bibliometri.swepub.kb.se/api/v1/classify/',
                contentType: 'application/json',
                dataType: 'JSON',
                type: 'post',
                data: JSON.stringify({
                    abstract: abstract,
                    classes: 3,
                    keywords: keywords,
                    level: 5,
                    title: title
                }),
                success: function(response) {
                    console.log(response);
                    var json = response.data;
                    var html = '<div><div class="resultsheader">Klassning från Swepub</div><br /><div> Värde: ' + JSON.stringify(response.suggestions[0].score) + '</div>';
                    html += '<div>Ämne:  ' + JSON.stringify(response.suggestions[0].swe.prefLabel) + '</div><br />';
                    html += '<div>Ämnesträd:  ' + JSON.stringify(response.suggestions[0].swe._topic_tree).replace(/\\/g, "").replace(/"\[/g, "").replace(/\]"/g, "") + '</div><br />';
                    if (response.suggestions[1] !== undefined) {
                        html += '<div>Värde: ' + JSON.stringify(response.suggestions[1].score) + '</div>';
                        html += '<div>Ämne:  ' + JSON.stringify(response.suggestions[1].swe.prefLabel) + '</div><br />'
                        html += '<div>Ämnesträd:  ' + JSON.stringify(response.suggestions[1].swe._topic_tree).replace(/\\/g, "").replace(/"\[/g, "").replace(/\]"/g, "") + '</div><br />'
                    };
                    if (response.suggestions[2] !== undefined) {
                        html += '<div>Värde: ' + JSON.stringify(response.suggestions[2].score) + '</div>';
                        html += '<div>Ämne:  ' + JSON.stringify(response.suggestions[2].swe.prefLabel) + '</div><br />'
                        html += '<div>Ämnesträd:  ' + JSON.stringify(response.suggestions[2].swe._topic_tree).replace(/\\/g, "").replace(/"\[/g, "").replace(/\]"/g, "") + '</div><br />'
                    };

                    $("#monkeyresultswrapper_right i").css("display", "none");
                    $('#monkeyresults_right').html(html);
                    $("#monkeytalk").html("Swepub svarade... se resultatet här nedanför");

                }
            })

        })

        $("div.diva2addtextchoice2:contains('Nationell ämneskategori') , div.diva2addtextchoice2:contains('National subject category')").parent().before(classButtonjq);

		*/

        ////////////////////////////////////
        //
        // Knapp vid PubMed-fältet
        //
        ////////////////////////////////////

        $('#openPubMedButtonjq').remove();
        var openPubMedButtonjq = $('<button class="link" id="openPubMedButtonjq" type="button">Öppna i PubMed</button>');
        openPubMedButtonjq.on("click", function() {
            var url = "https://www.ncbi.nlm.nih.gov/pubmed/" +
                $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val() +
                "";
            window.open(url, '_blank');
        })
        $("div.diva2addtextchoicecol:contains('PubMedID')").before(openPubMedButtonjq)

        //////////////////////////////////////////////////
        //
        // Knapp för dblp vid konferensfältet
        //
        //////////////////////////////////////////////////

        $('#dblpButtonjq').remove();
        var dblpButtonjq = $('<button id="dblpButtonjq" type="button">dblp</button>');
        //bind en clickfunktion som anropar API med värdet i DOI-fältet
        dblpButtonjq.on("click", function() {
            getDblp($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
        })
        $("div.diva2addtextchoicecol:contains('Konferens') , div.diva2addtextchoicecol:contains('Conference') ").parent().before(dblpButtonjq);

        //////////////////////////////////////////////////
        //
        // Knapp för google vid konferensfältet
        //
        //////////////////////////////////////////////////

        $('#confGoogleButtonjq').remove();
        var confGoogleButtonjq = $('<button class="link" id="confGoogleButtonjq" type="button">Googla på konferens</button>');
        //bind en clickfunktion som anropar google med värdet i konferensfältet
        confGoogleButtonjq.on("click", function() {
            var url = "https://www.google.com/search?q=" +
                $("div.diva2addtextchoicecol:contains('Konferens') , div.diva2addtextchoicecol:contains('Conference') ").parent().find('textarea').val() +
                "";
            window.open(url, '_blank'); // sök på konferensen i google
        })
        $("div.diva2addtextchoicecol:contains('Konferens') , div.diva2addtextchoicecol:contains('Conference') ").parent().before(confGoogleButtonjq);

        //////////////////////////////////////////////////
        //
        // Knapp för att ersätta semikolon med komma i keywordsfältet
        //
        //////////////////////////////////////////////////

        i = 0;
        $("div.diva2addtextchoicebr:contains('Nyckelord') , div.diva2addtextchoicebr:contains('Keywords')").each(function() {
            var thiz = this;

            $('#keywordsButtonjq' + i).remove();
            var keywordsButtonjq = $('<button id="keywordsButtonjq' + i + '" type="button">;->,</button>');
            keywordsButtonjq.on("click", function() {
                var keywords = $(thiz).parent().find('input').val();
                var altkeywords = keywords.replace(/;/g, ",");
                $(thiz).parent().find('input').val(altkeywords);
                $(thiz).parent().find('input').focus();
                $(this).focus();
            })

            //wrapper för layout.
            var html = $('<div id="monkeykeywords' + i + '" style="width: 100%;float: left"></div>');
            html.append(keywordsButtonjq)
            $(this).before(html)

            i++;
        });

        /////////////////////////////////////////////////////
        //
        // Knapp och länk till hjälpsida
        //
        /////////////////////////////////////////////////////

        $('#helpButtonjq').remove();
        var helpButtonjq = $('<button class="link" id="helpButtonjq" type="button">Hjälp</button>');
        //bind en clickfunktion öppnar en hjälpsida
        helpButtonjq.on("click", function() {
            var url = monkey_config.help_url;
            window.open(url, '_blank'); // öppna hjälpsida i ett nytt fönster
        })
        $(".diva2editmainer").before(helpButtonjq) // hjälpknapp längst upp på sidan
        $(".diva2impmainer").before(helpButtonjq)
        $(".diva2reviewmainer").before(helpButtonjq)
        $(".diva2pubmainer").before(helpButtonjq)

        ///////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Knapp och länk till extern sökning i webb-DiVA för att se eventuella dubbletter
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////

        $('#dubblettButtonjq').remove();
        var dubblettButtonjq = $('<button class="link" id="dubblettButtonjq" type="button">Dubblett?</button>');
        //bind en clickfunktion som anropar DiVA webbgränssnitt och söker på titel
        dubblettButtonjq.on("click", function() {
            var title = $("div.diva2addtextchoicebr:contains('Title'), div.diva2addtextchoicebr:contains('Titel')").parent().find('textarea').eq(0).val();
            var newtitle = title.replace(/&amp;/g, "%26").replace(/&amp;/g, "%26").replace(/&amp;/g, "%26").replace(/&lt;/g, "%3C").replace(/&gt;/g, "%3E").replace(/&quot;/g, "%22").replace(/&excl;/g, "%21").replace(/&percnt;/g, "%25").replace(/&apos;/g, "%27").replace(/&ast;/g, "%2A").replace(/&quest;/g, "%3F")
 // olika udda tecken percent-kodas
            var url = monkey_config.diva_search_url + "?dswid=-4067&language=en&searchType=RESEARCH&query=&af=%5B%5D&aq=%5B%5B%7B%22titleAll%22%3A%22" +
                newtitle +
                "%22%7D%5D%5D&aq2=%5B%5B%5D%5D&aqe=%5B%5D&noOfRimportForm:j_id758ows=50&sortOrder=author_sort_asc&sortOrder2=title_sort_asc&onlyFullText=false&sf=all"
            window.open(url, '_blank'); // sök i DiVA webb på titel, öppna i ett nytt fönster
        })
        $(".diva2editmainer").before(dubblettButtonjq) // dubblettknapp längst upp på sidan
        $(".diva2impmainer").before(dubblettButtonjq)
        $(".diva2reviewmainer").before(dubblettButtonjq)
        $(".diva2pubmainer").before(dubblettButtonjq)

        /////////////////////////////////
        //
        // QC och X + QC
        //
        /////////////////////////////////

        var d = new Date();
        var day = addZero(d.getDate());
        var month = addZero(d.getMonth() + 1);
        var year = addZero(d.getFullYear());
        var QC = "QC " + year + month + day;

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
                $iframe.contents().find("body p").html($iframe.contents().find("body p").html() + QC);
            });
        })
        $('#' + diva_id + '\\:notes').after(qcclearButton)


        ///////////////////////////////////////////////////////////////////////////////////
        //
        // Funktion för att skapa en knapp vid "Annan organisation" för varje författare,
        // för att sedan kunna radera detta fält när vi kopplat en lärosätesperson
        //
        ///////////////////////////////////////////////////////////////////////////////////

        var otherorg = $('#' + diva_id + '\\:authorSerie');
        i = 0;
        $(otherorg).find("div.diva2addtextchoicecol:contains('Annan organisation') , div.diva2addtextchoicecol:contains('Other organisation')").each(function() {
            var thiz = this;
            $('#clearorgButtonjq' + i).remove();
            var clearorgButtonjq = $('<button class="clearbutton" id="clearorgButtonjq' + i + '" type="button">X</button>');
            //bind en clickfunktion som skall rensa fältet för "Annan organisation"
            clearorgButtonjq.on("click", function() {
                $(thiz).next().find('input').val("");
            })
            if (!($(thiz).next().find('input').val().includes(";"))) { // vi vill inte ta bort hela "Annan organisation"-fältet som innehåller icke-affilieringar, d.v.s. de som har ett semikolon i sig
                $(this).next().find('input').after(clearorgButtonjq);
            }
            i++;
        });

        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Byt ut Orebro, Malardalen m . fl. till Örebro, Mälardalen etc. i fältet "Annan organisation"
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////////////

        var annanorg = $('#' + diva_id + '\\:authorSerie');
        i = 0;
        $(annanorg).find("div.diva2addtextchoicecol:contains('Annan organisation') , div.diva2addtextchoicecol:contains('Other organisation')").each(function() {
            var thiz = this;
            var html = '<div><div class="updateheader"></div>';
            var neworg = $(thiz).next().find('input').val();
            var neworg2 = neworg.replace(/\s*;(?!\s*$)\s*/g, '; ').replace(/\s*,(?!\s*$)\s*/g, ', ').trim().replace(/\.$/, "").replace(/\;$/, "").replace(/\,$/, "").replace(/\.\;/g, ";")
            .replace(/\; \;/g,";").replace(/Bracke/g, "Bräcke").replace(/Skondal/g, "Sköndal").replace(/Hogskola/g, "Högskola").replace(/Linkoping/g, "Linköping")
            .replace(/Malardalen/g, "Mälardalen").replace(/Orebro/g, "Örebro").replace(/Vasteras/g, "Västerås").replace(/Goteborg/g, "Göteborg").replace(/Norrkoping/g, "Norrköping")
            .replace(/Vaxjo/g, "Växjö").replace(/Umea/g, "Umeå").replace(/Lulea/g, "Luleå").replace(/Ostersund/g, "Östersund").replace(/Trollhattan/g, "Trollhättan")
            .replace(/Jonkoping/g, "Jönköping").replace(/Malmo/g, "Malmö").replace(/Sodertorn/g, "Södertörn").replace(/Gavle/g, "Gävle").replace(/Skovde/g, "Skövde")
            .replace(/Boras/g, "Borås").replace(/Sodertalje/g, "Södertälje").replace(/Borlange/g, "Borlänge").replace(/Harnosand/g, "Härnösand").replace(/Skelleftea/g, "Skellefteå")
            .replace(/Sjofart/g, "Sjöfart").replace(/Molnlycke/g, "Mölnlycke").replace(/Domsjo/g, "Domsjö").replace(/Varobacka/g, "Väröbacka").replace(/Sodra Innovat/g, "Södra Innovat")
            .replace(/Nykoping/g, "Nyköping").replace(/Ornskoldsvik/g, "Örnsköldsvik").replace(/Molndal/g, "Mölndal").replace(/Upplands Vasby/g, "Upplands Väsby")
            .replace(/Lowenstromska/g, "Löwenströmska").replace(/Skarholmen/g, "Skärholmen").replace(/Tjarno/g, "Tjärnö").replace(/Arrhenius Vag/g, "Arrhenius Väg")
            .replace(/Lantmateri/g, "Lantmäteri").replace(/Kraftnat/g, "Kraftnät").replace(/Stromstad/g, "Strömstad").replace(/Stralsakerhetsmyndigheten/g, "Strålsäkerhetsmyndigheten")
            .replace(/Vastra Gotaland/g, "Västra Götaland").replace(/Tromso/g, "Tromsø").replace(/Sodra Alvsborg/g, "Södra Älvsborg").replace(/Varmland/g, "Värmland").replace(/Vardal/g, "Vårdal")
            .replace(/Skane/g, "Skåne").replace(/Pitea/g, "Piteå").replace(/Ostergotland/g, "Östergötland").replace(/Kavlinge/g, "Kävlinge").replace(/Hassleholm/g, "Hässleholm")
            .replace(/Gotaland/g, "Götaland").replace(/Gastrikland/g, "Gästrikland").replace(/Folktandvarden/g, "Folktandvården").replace(/Branemark/g, "Brånemark")
            .replace(/\s*https:\/\/ror\.org\/[0-9a-z]{9}/g, "").replace(/\.$/, '');
            $(thiz).next().find('input').val(neworg2);
            if (neworg != neworg2) {
                html += '<div><p style="color:green;">Uppdaterat "Annan Organisation"</p></div>';
                $('#monkeyupdates').html(html + $('#monkeyupdates').html());
            } else {}
            i++;
        });

        //////////////////////////////////////////////////////////////////////////
        //
        //Knappar för *författare* till LDAP, Leta KTH anställda, KTH Intra, Google och ORCiD
        //
        //////////////////////////////////////////////////////////////////////////

        var authors = $('#' + diva_id + '\\:authorSerie');
        i = 0;
        $(authors).find('.diva2addtextarea').each(function() {
            var thiz = this;

            //LDAP/UG
            if (monkey_config.ldap) {
                $('#ldapButtonAuthorjq' + i).remove();
                var ldapButtonjq = $('<button id="ldapButtonAuthorjq' + i + '" type="button">LDAP-info</button>');
                ldapButtonjq.on("click", function() {
                    getLDAP($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val(), '');
                })
                $(this).before(ldapButtonjq)
            }
            //Leta KTH-anställda
            if (monkey_config.letaanstallda) {
                $('#letaButtonAuthorjq' + i).remove();
                var letaButtonjq = $('<button id="letaButtonAuthorjq' + i + '" type="button">Leta KTH-anställda</button>');
                letaButtonjq.on("click", function() {
                    getLeta($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
                })
                $(this).before(letaButtonjq)
            }

            //Sök i ORCiD
            if (monkey_config.orcid) {
                $('#orcidButtonAuthorjq' + i).remove();
                var orcidButtonjq = $('<button id="orcidButtonAuthorjq' + i + '" type="button">Sök i ORCiD</button>');
                orcidButtonjq.on("click", function() {
                    getOrcid($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
                })
                $(this).before(orcidButtonjq);
            }

            //Intranät förnamn efternamn
            if (monkey_config.intranet) {
                $('#intraButtonAuthorjq' + i).remove();
                var intraButtonjq = $('<button class="link" id="intraButtonAuthorjq' + i + '" type="button">' + monkey_config.university + ' Intra</button>');
                intraButtonjq.on("click", function() {
                    var url = monkey_config.university_search_url + "?q=" +
                        $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                        "%20" +
                        $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                        "&urlFilter=" + monkey_config.university_intranet_url + "&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
                        // ta bort eventuella $$$ från efternamnen före sökning
                    var newurl = url.replace("$$$", "")
                        // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i Intra
                    var newurl2 = newurl.replace(/[A-Z]\./g, "")
                    window.open(newurl2, '_blank'); // sök på förnamn efternamn på Intranät
                })
                $(this).before(intraButtonjq)
            }

            //Google.com förnamn + efternamn + lärosäte
            $('#googleButtonAuthorjq' + i).remove();
            var googleButtonjq = $('<button class="link" id="googleButtonAuthorjq' + i + '" type="button">Google</button>');
            googleButtonjq.on("click", function() {
                var url = "https://www.google.com/search?q=" + monkey_config.university + "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                    "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val()
                    // ta bort eventuella $$$ från efternamnen före sökning
                var newurl = url.replace("$$$", "")
                window.open(newurl, '_blank'); // sök på förnamn efternamn + lärosäte i google
            })
            $(this).before(googleButtonjq)

            i++;
        });

        //////////////////////////////////////////////////////////////////////////
        //
        //Knappar för *redaktörer* till LDAP, Leta KTH anställda, KTH Intra, Google och ORCiD
        //
        //////////////////////////////////////////////////////////////////////////

        var editors = $('#' + diva_id + '\\:editorSerie');
        i = 0;
        $(editors).find('.diva2addtextarea').each(function() {
            var thiz = this;

            //LDAP/UG
            if (monkey_config.ldap) {
                $('#ldapButtonEditorjq' + i).remove();
                var ldapButtonjq = $('<button id="ldapButtonEditorjq' + i + '" type="button">LDAP-info</button>');
                ldapButtonjq.on("click", function() {
                    getLDAP($(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val(), '');
                })
                $(this).before(ldapButtonjq)
            }

            //Leta KTH-anställda
            if (monkey_config.letaanstallda) {
                $('#letaButtonEditorjq' + i).remove();
                var letaButtonjq = $('<button id="letaButtonEditorjq' + i + '" type="button">Leta KTH-anställda</button>');
                letaButtonjq.on("click", function() {
                    getLeta($(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val());
                })
                $(this).before(letaButtonjq)
            }

            //Sök i ORCiD
            if (monkey_config.orcid) {
                $('#orcidButtonEditorjq' + i).remove();
                var orcidButtonjq = $('<button id="orcidButtonEditorjq' + i + '" type="button">Sök i ORCiD</button>');
                orcidButtonjq.on("click", function() {
                    getOrcid($(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val());
                })
                $(this).before(orcidButtonjq);
            }

            //Intranät förnamn efternamn
            if (monkey_config.intranet) {
                $('#intraButtonEditorjq' + i).remove();
                var intraButtonjq = $('<button class="link" id="intraButtonEditorjq' + i + '" type="button">' + monkey_config.university + ' Intra</button>');
                intraButtonjq.on("click", function() {
                    var url = monkey_config.university_search_url + "?q=" +
                        $(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val() +
                        "%20" +
                        $(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val() +
                        "&urlFilter=" + monkey_config.university_intranet_url + "&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
                        // ta bort eventuella $$$ från efternamnen före sökning
                    var newurl = url.replace("$$$", "")
                        // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i KTH Intra
                    var newurl2 = newurl.replace(/[A-Z]\./g, "")
                        // sök på förnamn efternamn på KTH Intranät
                    window.open(newurl2, '_blank');
                })
                $(this).before(intraButtonjq)
            }

            //Google.com förnamn + efternamn + Lärosäte
            $('#googleButtonEditorjq' + i).remove();
            var googleButtonjq = $('<button class="link" id="googleButtonEditorjq' + i + '" type="button">Google</button>');
            googleButtonjq.on("click", function() {
                var url = "https://www.google.com/search?q=" + monkey_config.university + "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val() +
                    "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val()
                    // ta bort eventuella $$$ från efternamnen före sökning
                var newurl = url.replace("$$$", "")
                    // sök på förnamn efternamn + lärosäte i google
                window.open(newurl, '_blank');
            })
            $(this).before(googleButtonjq)

            i++;
        });

        //////////////////////////////////////////////////////////////////////////
        //
        //Knappar för *supervisors* till LDAP, Leta KTH anställda, KTH Intra, Google och ORCiD
        //
        //////////////////////////////////////////////////////////////////////////

        var supervisors = $('#' + diva_id + '\\:supervisorSerie');
        i = 0;
        $(supervisors).find('.diva2addtextarea').each(function() {
            var thiz = this;

            //LDAP/UG
            if (monkey_config.ldap) {
                $('#ldapButtonSupervisorjq' + i).remove();
                var ldapButtonjq = $('<button id="ldapButtonSupervisorjq' + i + '" type="button">LDAP-info</button>');
                ldapButtonjq.on("click", function() {
                    getLDAP($(thiz).find('.diva2addtextplusname input[id$="supGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="supFamily"]').val(), '');
                })
                $(this).before(ldapButtonjq)
            }

            //Leta KTH-anställda
            if (monkey_config.letaanstallda) {
                $('#letaButtonSupervisorjq' + i).remove();
                var letaButtonjq = $('<button id="letaButtonSupervisorjq' + i + '" type="button">Leta KTH-anställda</button>');
                letaButtonjq.on("click", function() {
                    getLeta($(thiz).find('.diva2addtextplusname input[id$="supGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="supFamily"]').val());
                })
                $(this).before(letaButtonjq)
            }

            //Sök i ORCiD
            if (monkey_config.orcid) {
                $('#orcidButtonSupervisorjq' + i).remove();
                var orcidButtonjq = $('<button id="orcidButtonSupervisorjq' + i + '" type="button">Sök i ORCiD</button>');
                orcidButtonjq.on("click", function() {
                    getOrcid($(thiz).find('.diva2addtextplusname input[id$="supGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="supFamily"]').val());
                })
                $(this).before(orcidButtonjq);
            }

            //Intranät förnamn efternamn
            if (monkey_config.intranet) {
                $('#intraButtonSupervisorjq' + i).remove();
                var intraButtonjq = $('<button class="link" id="intraButtonSupervisorjq' + i + '" type="button">' + monkey_config.university + ' Intra</button>');
                intraButtonjq.on("click", function() {
                    var url = monkey_config.university_search_url + "?q=" +
                        $(thiz).find('.diva2addtextplusname input[id$="supGiven"]').val() +
                        "%20" +
                        $(thiz).find('.diva2addtextplusname input[id$="supFamily"]').val() +
                        "&urlFilter=" + monkey_config.university_intranet_url + "&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
                        // ta bort eventuella $$$ från efternamnen före sökning
                    var newurl = url.replace("$$$", "")
                        // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i KTH Intra
                    var newurl2 = newurl.replace(/[A-Z]\./g, "")
                        // sök på förnamn efternamn på KTH Intranät
                    window.open(newurl2, '_blank');
                })
                $(this).before(intraButtonjq)
            }

            //Google.com förnamn + efternamn + Lärosäte
            $('#googleButtonSupervisorjq' + i).remove();
            var googleButtonjq = $('<button class="link" id="googleButtonSupervisorjq' + i + '" type="button">Google</button>');
            googleButtonjq.on("click", function() {
                var url = "https://www.google.com/search?q=" + monkey_config.university + "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="supGiven"]').val() +
                    "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="supFamily"]').val()
                    // ta bort eventuella $$$ från efternamnen före sökning
                var newurl = url.replace("$$$", "")
                    // sök på förnamn efternamn + lärosäte i google
                window.open(newurl, '_blank');
            })
            $(this).before(googleButtonjq)

            i++;
        });

        //////////////////////////////////////////////////////////////////////////
        //
        // Knappar för *opponenter* till LDAP, Leta KTH anställda, KTH Intra, Google och ORCiD
        // Inte sannolikt att det finns KTH:are bland opponenterna, men kanske...
        //
        //////////////////////////////////////////////////////////////////////////

        var opponents = $('#' + diva_id + '\\:opponentSerie');
        i = 0;
        $(opponents).find('.diva2addtextarea').each(function() {
            var thiz = this;

            //LDAP/UG
            if (monkey_config.ldap) {
                $('#ldapButtonOpponentjq' + i).remove();
                var ldapButtonjq = $('<button id="ldapButtonOpponentjq' + i + '" type="button">LDAP-info</button>');
                ldapButtonjq.on("click", function() {
                    getLDAP($(thiz).find('.diva2addtextplusname input[id$="oppGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="oppFamily"]').val(), '');
                })
                $(this).before(ldapButtonjq)
            }

            //Leta KTH-anställda
            if (monkey_config.letaanstallda) {
                $('#letaButtonOpponentjq' + i).remove();
                var letaButtonjq = $('<button id="letaButtonOpponentjq' + i + '" type="button">Leta KTH-anställda</button>');
                letaButtonjq.on("click", function() {
                    getLeta($(thiz).find('.diva2addtextplusname input[id$="oppGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="oppFamily"]').val());
                })
                $(this).before(letaButtonjq)
            }

            //Sök i ORCiD
            if (monkey_config.orcid) {
                $('#orcidButtonOpponentjq' + i).remove();
                var orcidButtonjq = $('<button id="orcidButtonOpponentjq' + i + '" type="button">Sök i ORCiD</button>');
                orcidButtonjq.on("click", function() {
                    getOrcid($(thiz).find('.diva2addtextplusname input[id$="oppGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="oppFamily"]').val());
                })
                $(this).before(orcidButtonjq);
            }

            //Intranät förnamn efternamn
            if (monkey_config.intranet) {
                $('#intraButtonOpponentjq' + i).remove();
                var intraButtonjq = $('<button class="link" id="intraButtonOpponentjq' + i + '" type="button">' + monkey_config.university + ' Intra</button>');
                intraButtonjq.on("click", function() {
                    var url = monkey_config.university_search_url + "?q=" +
                        $(thiz).find('.diva2addtextplusname input[id$="oppGiven"]').val() +
                        "%20" +
                        $(thiz).find('.diva2addtextplusname input[id$="oppFamily"]').val() +
                        "&urlFilter=" + monkey_config.university_intranet_url + "&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
                        // ta bort eventuella $$$ från efternamnen före sökning
                    var newurl = url.replace("$$$", "")
                        // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i KTH Intra
                    var newurl2 = newurl.replace(/[A-Z]\./g, "")
                        // sök på förnamn efternamn på KTH Intranät
                    window.open(newurl2, '_blank');
                })
                $(this).before(intraButtonjq)
            }

            //Google.com förnamn + efternamn + Lärosäte
            $('#googleButtonOpponentjq' + i).remove();
            var googleButtonjq = $('<button class="link" id="googleButtonOpponentjq' + i + '" type="button">Google</button>');
            googleButtonjq.on("click", function() {
                var url = "https://www.google.com/search?q=" + monkey_config.university + "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="oppGiven"]').val() +
                    "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="oppFamily"]').val()
                    // ta bort eventuella $$$ från efternamnen före sökning
                var newurl = url.replace("$$$", "")
                    // sök på förnamn efternamn + lärosäte i google
                window.open(newurl, '_blank');
            })
            $(this).before(googleButtonjq)

            i++;
        });

        //////////////////////////////////////////////////////////////////////////
        //
        // Knappar för *examinatorer* till LDAP, Leta KTH anställda, KTH Intra, Google och ORCiD
        //
        //////////////////////////////////////////////////////////////////////////

        var examiners = $('#' + diva_id + '\\:examinerSerie');
        i = 0;
        $(examiners).find('.diva2addtextarea').each(function() {
            var thiz = this;

            //LDAP/UG
            if (monkey_config.ldap) {
                $('#ldapButtonExaminerjq' + i).remove();
                var ldapButtonjq = $('<button id="ldapButtonExaminerjq' + i + '" type="button">LDAP-info</button>');
                ldapButtonjq.on("click", function() {
                    getLDAP($(thiz).find('.diva2addtextplusname input[id$="examinerGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="examinerFamily"]').val(), '');
                })
                $(this).before(ldapButtonjq)
            }

            //Leta KTH-anställda
            if (monkey_config.letaanstallda) {
                $('#letaButtonExaminerjq' + i).remove();
                var letaButtonjq = $('<button id="letaButtonExaminerjq' + i + '" type="button">Leta KTH-anställda</button>');
                letaButtonjq.on("click", function() {
                    getLeta($(thiz).find('.diva2addtextplusname input[id$="examinerGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="examinerFamily"]').val());
                })
                $(this).before(letaButtonjq)
            }

            //Sök i ORCiD
            if (monkey_config.orcid) {
                $('#orcidButtonExaminerjq' + i).remove();
                var orcidButtonjq = $('<button id="orcidButtonExaminerjq' + i + '" type="button">Sök i ORCiD</button>');
                orcidButtonjq.on("click", function() {
                    getOrcid($(thiz).find('.diva2addtextplusname input[id$="examinerGiven"]').val(), $(thiz).find('.diva2addtextplusname input[id$="examinerFamily"]').val());
                })
                $(this).before(orcidButtonjq);
            }

            //Intranät förnamn efternamn
            if (monkey_config.intranet) {
                $('#intraButtonExaminerjq' + i).remove();
                var intraButtonjq = $('<button class="link" id="intraButtonExaminerjq' + i + '" type="button">' + monkey_config.university + ' Intra</button>');
                intraButtonjq.on("click", function() {
                    var url = monkey_config.university_search_url + "?q=" +
                        $(thiz).find('.diva2addtextplusname input[id$="examinerGiven"]').val() +
                        "%20" +
                        $(thiz).find('.diva2addtextplusname input[id$="examinerFamily"]').val() +
                        "&urlFilter=" + monkey_config.university_intranet_url + "&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
                        // ta bort eventuella $$$ från efternamnen före sökning
                    var newurl = url.replace("$$$", "")
                        // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i KTH Intra
                    var newurl2 = newurl.replace(/[A-Z]\./g, "")
                        // sök på förnamn efternamn på KTH Intranät
                    window.open(newurl2, '_blank');
                })
                $(this).before(intraButtonjq)
            }

            //Google.com förnamn + efternamn + Lärosäte
            $('#googleButtonExaminerjq' + i).remove();
            var googleButtonjq = $('<button class="link" id="googleButtonExaminerjq' + i + '" type="button">Google</button>');
            googleButtonjq.on("click", function() {
                var url = "https://www.google.com/search?q=" + monkey_config.university + "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="examinerGiven"]').val() +
                    "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="examinerFamily"]').val()
                    // ta bort eventuella $$$ från efternamnen före sökning
                var newurl = url.replace("$$$", "")
                    // sök på förnamn efternamn + lärosäte i google
                window.open(newurl, '_blank');
            })
            $(this).before(googleButtonjq)

            i++;
        });



        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Snott från Malmö
        // Ta bort punkt i slutet av titel
        // *mau
        /////////////////////////////////////////////////////////////////////////////////////////////////////////

        function updateIframeContent(iframe, message) {
            let body = iframe.contents().find("body");
            if (body.length > 0) {
                let content = body.html().trim();
                let cleanedContent = content.replace(/\.$/, "");
                body.html(cleanedContent);

                if (content !== cleanedContent) {
                    let html = `<div><div class="updateheader"></div><div><p style="color:green;">Uppdaterat "${message}"</p></div></div>`;
                    $('#monkeyupdates').html(html + $('#monkeyupdates').html());
                }
            }
        }

        updateIframeContent($maintitleiframe, "Titel");
        updateIframeContent($subtitleiframe, "Undertitel");
        updateIframeContent($bookmaintitleiframe, "Boktitel");
        updateIframeContent($booksubtitleiframe, "Bokundertitel");
     /**
     * Snott från Malmö
     *Funktion för att anropa Pubmed och hämta information via DOI
     *  *mau
     * @param {string} doi
     **/
        // Wait for the page to load
        $(document).ready(function() {
            event.preventDefault(); // Prevent any default actions
            // Extract DOI from the page
            var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
            i = 0;
            if (doi) {
                // Check if the PubMedID field is empty
                var pubmedField = $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input');
                if (pubmedField.val() === "") {
                    // Construct the PubMed search URL
                    var pubmedUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term="${doi}"[doi]`;
                    // Fetch the PubMedID
                    fetch(pubmedUrl)
                        .then(function(response) {
                        return response.text();
                    })
                        .then(function(data) {
                        // Parse the XML response
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(data, "text/xml");

                        // Use XPath to find the <Id> element
                        var xpathResult = xmlDoc.evaluate("//Id", xmlDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        var idElement = xpathResult.singleNodeValue;
                        var html = '<div><div class="updateheader"></div>';

                        if (idElement) {
                            var pmid = idElement.textContent.trim();
                            if (pmid !== "") {
                                pubmedField.val(pmid);
                            }
                            html += '<div><p style="color:green;">Lagt till PMID: '+ pmid + '</p></div>';
                            $('#monkeyupdates').html(html + $('#monkeyupdates').html());
                        }
                    });
                }
            }
            i++;
        });
        //////////////////////////////////////////////////
        // Snott från Malmö
        // Knapp för att ersätta komma med semikolon i editorfältet
        //  *mau
        //////////////////////////////////////////////////

        i = 0;
        $("div.diva2addtextchoicecol:contains('Redaktör') , div.diva2addtextchoicecol:contains('Editor')").each(function() {
            var thiz = this;

            $('#editorButtonjq' + i).remove();
            var editorButtonjq = $('<button id="editorButtonjq' + i + '" type="button">,->;</button>');
            editorButtonjq.on("click", function() {
                var editor = $(thiz).parent().find('input').val();
                var alteditor = editor.replace(/ORCID Icon/g,"").replace(/ed./g,"").replace(/[(]/g,"").replace(/[)]/g,"").replace(/, and /g, "; ").replace(/, & /g, "; ").replace(/, och /g, "; ").replace(/,/g, ";").replace(/ och /g, "; ").replace(/ and /g,"; ").replace(/ & /g,"; ").replace(/ ;/g,";");
                $(thiz).parent().find('input').val(alteditor);
                $(thiz).parent().find('input').focus();
                $(this).focus();
            })

            //wrapper för layout.
            var html = $('<div id="monkeyeditor' + i + '" style="width: 100%;float: left"></div>');
            html.append(editorButtonjq)
            $(this).before(html)

            i++;
        });


        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Snott från Malmö
        // TA bort inledande "/" ORCID
        // *mau
        /////////////////////////////////////////////////////////////////////////////////////////////////////////

                var ORCID = $('#' + diva_id + '\\:authorSerie');
        i = 0;
        $(ORCID).find("div.diva2addtextchoicecolbr:contains('ORCiD')").each(function() {
            var thiz = this;
            var html = '<div><div class="updateheader"></div>';
            var neworcid = $(thiz).next().find('input').val();
            var neworcid2 = neworcid.replace(/\//g, "")
            $(thiz).next().find('input').val(neworcid2);
            if (neworcid != neworcid2) {
                html += '<div><p style="color:green;">Uppdaterat "ORCID"</p></div>';
                $('#monkeyupdates').html(html + $('#monkeyupdates').html());
            } else {}
            i++;
        });

        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Hämtar diverse automatiskt när posten öppnas - det Anders kallar headless
        //
        // T ex från Scopus, WoS, Sök i DiVA (efter potentiella dubbletter)
        //
        // Kör inte om det är en re_init t ex koppla personpost
        /////////////////////////////////////////////////////////////////////////////////////////////////////////

        if (re_init != true) {
            if (monkey_config.ldap) {
                await getLDAP('', '', $('.diva2identifier:eq(2)').html())
            }
            if (monkey_config.scopus) {
                await getScopus($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val())
            }
            if (monkey_config.wos) {
                await getWoS($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val())
            }
            $('html, body').animate({
                scrollTop: 0
            }, '1');

            /////////////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // Öppna DiVA och kolla efter dubbletter när en post öppnas.
            //
            /////////////////////////////////////////////////////////////////////////////////////////////////////////

            $maintitleiframe = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first();
            // ta bort saker som innehåller & och ? och " som sökningen inte klarar av +
            // regex för ta att bort all html
            var htmlRegexG = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
            getDiVA($maintitleiframe.contents().find("body").html().replace(htmlRegexG, "").replace(/&nbsp;/g, " ").replace(/\?/g, "").replace(/["]+/g, "").replace(/&amp;/g, "?"), 'mods');

            /////////////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // Gå till Crossref API och hämta saker automatiskt - skall komma om knappen vid "Other publisher" faller användarna i smaken
            //
            /////////////////////////////////////////////////////////////////////////////////////////////////////////

            getCrossref($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val())

        }
        // End async function init()
    }

    /**
     * Funktion som startar Apan beroende på läge(edit, import etc)
     *
     * @param {*} selector
     */

    function startMonkey() {
        waitForKeyElements(diva_id_selector, function() {
            diva_id = $(diva_id_selector).closest('form').attr('id')
            observer = new MutationObserver(mutationCallback)
            waitForKeyElements(diva_observer_selector, function() {
                authortarget = $(diva_observer_selector)[0];
                observer.observe(authortarget, observer_config);
            });
            waitForKeyElements('#' + diva_id + '\\:notes_ifr', function() {
                //Kolla om användartoken finns och verifera i så fall, annars inloggning
                if (monkey_config.login) {
                    if (Cookies.get('token')) {
                        if (typeof Cookies.get('token') === 'undefined' ||
                            Cookies.get('token') == 'undefined' ||
                            Cookies.get('token') == '') {
                            Cookies.remove('token');
                        } else {
                            $("#monkeyresultswrapper i").css("display", "inline-block");
                            $("#monkeytalk").html("Jag gör mig redo...");
                            verifytoken(Cookies.get('token'));
                            $("#monkeyresultswrapper").css("display", "block");
                            $("#monkeyresultswrapper_right").css("display", "block");
                            return
                        }
                    } else {
                        Cookies.remove('token');
                        $("#monkeyresultswrapper").css("display", "block");
                        $("#monkeyresultswrapper_right").css("display", "block");
                        $("#monkeylogin").css("display", "block");
                        monkeylogin();
                    }
                } else {
                    //Initiera apan utan login
                    init(false);
                    $("#monkeyresultswrapper").css("display", "block");
                    $("#monkeyresultswrapper_right").css("display", "block");
                }
            });
        });
    }

    ///////////////////////////////////////////////////////////////////////////////////
    //
    // Huvudkod
    //
    ///////////////////////////////////////////////////////////////////////////////////

    styles();
    //Overlay för att visa "popup" på sidan
    //$('body.diva2margin').append($('<div id="ldapoverlay"></div>'));

    //DIV för att visa Apans resultat till vänster på sidan
    var monkeyresultswrapper =
        ($('<div style="display:none" id="monkeyresultswrapper">' +
            '<div>' +
            '<img class="logo" src="' + monkey_config.monkey_image_url + '">' +
            '<div class="bubble">' +
            '<i class="fa fa-spinner fa-spin"></i>' +
            '<div id="monkeytalk"></div>' +
            '</div>' +
            '</div>' +
            '<div class="monkeyheader">' +
            '<h1>DiVA-Apan</h1>' +
            '</div>' +
            '<div id="monkeylogin">' +
            '<form id="monkeyloginform">' +
            '<div>Logga in till Apan</div>' +
            '<div class = "flexbox column rowpadding">' +
            '<input class="rowmargin" id="username" name="username" placeholder="kthid" type="text">' +
            '<input class="rowmargin" id="password" name="password" placeholder="password" type="password">' +
            '</div>' +
            '</form>' +
            '<button id="login">Login</button>' +
            '</div>' +
            '<h2>' +
            'Uppdateringar' +
            '</h2>' +
            '<div id="monkeyupdates" class="flexbox column">' +
            '</div>' +
            '<hr class="solid">' +
            '<h2>' +
            'Resultat' +
            '</h2>' +
            '<div id="monkeyresults" class="flexbox column">' +
            '</div>' +
            '</div>'));
    $('body.diva2margin').prepend(monkeyresultswrapper);

    //DIV för att kunna visa Apresultat även till höger på sidan
    var monkeyresultswrapper_right =
        ($('<div style="display:none" id="monkeyresultswrapper_right">' +
            '<div class="monkeyheader">' +
            '</div>' +
            '<h2>' +
            'Resultat' +
            '</h2>' +
            '<div id="monkeyresults_right" class="flexbox column">' +
            '</div>' +
            '</div>'));
    $('body.diva2margin').prepend(monkeyresultswrapper_right);

    // Vilket DiVA-läge (edit, publish, review, import eller add)
    if (window.location.href.indexOf("editForm.jsf") !== -1) {
        diva_observer_selector = '.diva2editmainer .diva2addtextbotmargin';
        diva_id_selector = '#diva2editcontainer';
    } else if (window.location.href.indexOf("publishForm.jsf") !== -1) {
        diva_observer_selector = '.diva2pubmainer .diva2addtextbotmargin';
        diva_id_selector = '#diva2editcontainer';
    } else if (window.location.href.indexOf("reviewForm.jsf") !== -1) {
        diva_observer_selector = '.diva2reviewmainer .diva2addtextbotmargin';
        diva_id_selector = '#diva2editcontainer';
    } else if (window.location.href.indexOf("importForm.jsf") !== -1) {
        diva_observer_selector = '.diva2impmainer .diva2addtextbotmargin .diva2addtextbotmargin';
        diva_id_selector = '#diva2addcontainer';
    } else if (window.location.href.indexOf("add2.jsf") !== -1) {
        diva_observer_selector = '.diva2addtextmainer .diva2addtextbotmargin';
        diva_id_selector = '#diva2addcontainer';
    }

    startMonkey()

})();

function styles() {
    GM_addStyle(`
@import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css");

::-webkit-scrollbar {
-webkit-appearance: none;
width: 10px;
}

::-webkit-scrollbar-thumb {
border-radius: 5px;
background-color: rgba(0,0,0,.5);
-webkit-box-shadow: 0 0 1px rgba(255,255,255,.5);
}

.logo {
width: 80px;
}

#monkeytalk,
#monkeytalk_right  {
width: 150px;
}

.oa {
width: 8px;
}

.monkeyheader {
font-weight: bold;
font-size: 1.06em;
padding-bottom: 0px;
}

#monkeyresultswrapper i,
#monkeyresultswrapper_right i {
font-size: 32px;
position: absolute;
top: 18px;
left: 170px;
z-index: 1;
}

#wosapiButtonjq i,
#monkeyresultswrapper i,
#monkeyresultswrapper_right i {
display: none;
}

#monkeylogin {
display: none;
overflow: hidden;
padding: 5px;
}

#monkeyresultswrapper {
position: fixed;
top: 20px;
left: 0;
width: 320px;
height: 100%;
overflow: auto;
padding-left: 10px;
background: #ffffff;
}

#monkeyresultswrapper_right {
position: fixed;
top: 20px;
right: 0;
width: 320px;
height: 100%;
overflow: auto;
padding-left: 10px;
background: #ffffff;
}

#monkeyupdates,
#monkeyupdates_right {
height: 150px;
overflow: auto;
}

#monkeyresults,
#monkeyresults_right,
#monkeyupdates,
#monkeyupdates_right {
padding: 0px;
font-size: 12px;
margin-bottom: 20px;
width: 300px
}

.updateheader, .resultsheader {
font-weight: bold;
}

#monkeyresults a,
#monkeyresults_right a,
#ldapoverlay a {
font-size: 0.8rem !important;
}

hr.solid {
border-top: 3px solid #bbb;
}

.inforecord {
padding-top: 5px;
padding-bottom: 5px;
}

.inforecord>div {
display: flex;
border-top: 1px solid;
border-left: 1px solid;
border-right: 1px solid
}

.inforecord>div>span:first-child {
border-right: 1px solid
}

.inforecord>div:last-child {
border-bottom: 1px solid;
}

.inforecord span {
word-break: break-all;
flex: 1;
padding: 2px;
}

.inforecord span {
}

.fieldtitle {
font-weight: bold;
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
font-size: 0.8rem;
line-height: 1;
border-radius: .25rem;
outline: none;
margin: 1px;
cursor: pointer;
}

button:hover {
background-color: #dd2f87;
}

button.link {
background-color: #007fae;
}

button.link:hover {
background-color: #005cae;
}

.clearbutton {
line-height: 1;
height: 17px;
padding: 0px 10px;
font-size: 11px;
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

.bubble
{
position: absolute;
width: 200px;
height: 60px;
padding: 5px;
background: #e8e2e2;
-webkit-border-radius: 10px;
-moz-border-radius: 10px;
border-radius: 10px;
display: inline-block;
margin-left: 10px;
font-size: 12px;
top: 5px;
}

.bubble:after
{
content: '';
position: absolute;
border-style: solid;
border-width: 10px 10px 10px 0;
border-color: transparent #e8e2e2;
display: block;
width: 0;
z-index: 1;
left: -10px;
top: 35px;
}

`);
}
