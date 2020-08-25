// ==UserScript==
// @name     DiVA
// @version      1.2
// @description  En Apa för att hjälpa till med DiVA-arbetet på KTH Biblioteket
// @author Thomas Lind, Anders Wändahl
// @updateURL    https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-DiVA-tampermonkey/raw/master/DiVA.js
// @match    https://kth.diva-portal.org/dream/edit/editForm.jsf*
// @match    https://kth.diva-portal.org/dream/import/importForm.jsf*
// @match    https://kth.diva-portal.org/dream/publish/publishForm.jsf*
// @match    https://kth.diva-portal.org/dream/review/reviewForm.jsf*
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
// @connect  portal.issn.org
// @connect  www.worldcat.org
// @connect  dblp.uni-trier.de
// @connect  search.crossref.org
// @connect  api.crossref.org
// @connect  bibliometri.swepub.kb.se

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
    var monkey_config = {
        login : true,
        ldap : true,
        letaanstallda : true,
        wos : true,
        scopus : true,
        qc : true,
        diva_search_api_url : 'https://kth.diva-portal.org/smash/export.jsf',
        diva_search_url : 'https://kth.diva-portal.org/smash/resultList.jsf',
        university_url : 'www.kth.se',
        university_intranet_url : 'intra.kth.se',
        scopus_api_url : 'https://api.elsevier.com/content/abstract/doi/',
        dblp_api_doi_url : 'https://dblp.uni-trier.de/doi/xml/',
        dblp_api_rec_url : 'https://dblp.uni-trier.de/rec/xml/',
        google_search : 'KTH',
        wos_api_url : 'https://ws.isiknowledge.com/cps/xrpc',
        api_username_wos : 'kthroyal',
        api_password_wos : 'r0yAl#1431',
        api_key_scopus : ''
    }
    var ldap_apikey;
    var orcid_apikey;
    var letaanstallda_apikey;
    var scopus_apikey;
    var ldap_apiurl = 'https://lib.kth.se/ldap/api/v1/';
    var orcid_apiurl = 'https://lib.kth.se/orcid/api/v1/orcid/';
    var letaanstallda_apiurl = 'https://apps-ref.lib.kth.se/webservices/letaanstallda/api/v1/';
    var scopus_apiurl = 'https://api.elsevier.com/content/abstract/doi/';
    var wos_apiurl = 'https://apps.lib.kth.se/alma/wos/wosapi_b.php?source=wos&doi=';
    var dblp_apiurl1 = 'https://dblp.uni-trier.de/doi/xml/';
    var dblp_apiurl2 = 'https://dblp.uni-trier.de/rec/xml/';
    var diva_searchurl = 'https://kth.diva-portal.org/smash/export.jsf';
    var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();

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

    /**
     * Funktion för att sätta apinycklar
     *
     * @param {object} keys
     */
    function setapikeys(keys) {
        ldap_apikey = keys.apikeys.ldap;
        orcid_apikey = keys.apikeys.orcid;
        letaanstallda_apikey = keys.apikeys.letaanstallda;
        scopus_apikey = keys.apikeys.scopus;
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
                url: ldap_apiurl + 'divamonkey',
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
                        Cookies.set('token', response.token, { expires: 30 })
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
                url:  ldap_apiurl + 'login',
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
        $('#monkeytalk').html('Nu blev det fel!');
    }

    /**
     * Hämta info från ORCiD
     *
     * @param {*} fnamn
     * @param {*} enamn
     */
    function getOrcid(fnamn, enamn) {
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med ORCiD. Det kan ta lite tid...");
        var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning

        var url = orcid_apiurl + enamn2 + "/" + fnamn2 + "/?token=" + orcid_apikey;
        axios.get(url)
            .then(function (response) {
            var html = '<div><h2>Information från ORCiD</h2>';
            if (response.data) {
                var json = response.data
                if (response.status == 201) {
                    html += "<p>Inga användare hittades</p>";
                } else {
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
            }
            html += '</div>'
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyresults').html(html);
            $("#monkeytalk").html("ORCiD svarade... se resultatet här nedanför");
        })
            .catch(function (error) {
            api_error(error.response);
        })
            .then(function () {
        });
    }

    /**
     * Hämta info från LDAP
     *
     * @param {*} fnamn
     * @param {*} enamn
     * @param {*} kthid
     */
    async function getLDAP(fnamn, enamn, kthid) {
        $("#monkeyresultswrapper_right i").css("display", "inline-block");  // visas i högermarginalen sen version 1.1.15
        $("#monkeytalk_right").html("Jag pratar med LDAP...");
        var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
        var url = ldap_apiurl + 'users/' +
            fnamn2 +
            '* ' +
            enamn2 +
            ' *' +
            '?token=' + ldap_apikey;

        if (kthid!= "") {
            url = ldap_apiurl + 'kthid/' +
                kthid +
                '?token=' + ldap_apikey;
        }


        await axios.get(url)
            .then(function (response) {
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
                        html += '<h2>kthid: ' + json.ugusers[key].ugKthid +'</h2>';
                        html += '<div><span class="fieldtitle">Efternamn: </span><span>' + json.ugusers[key].sn + '</span></div>' +
                            '<div><span class="fieldtitle">Förnamn: </span><span>' + json.ugusers[key].givenName + '</span></div>' +
                            //'<div><span class="fieldtitle">Kthid: </span><span>' + json.ugusers[key].ugKthid + '</span></div>' +
                            '<div><span class="fieldtitle">Titel: </span><span>' + json.ugusers[key].title + '</span></div>' +
                            '<div><span class="fieldtitle">Skola/org: </span><span>' + json.ugusers[key].kthPAGroupMembership + '</span></div>' +
                            '<div><span class="fieldtitle">KTH-affiliering: </span><span>' + json.ugusers[key].ugPrimaryAffiliation + '</span></div>' +
                            '<div><span class="fieldtitle">Email: </span><span>' + json.ugusers[key].mail + '</span></div>'
                        html += '</div>';
                    });

                }
            }

            html += '</div>'
            $("#monkeyresultswrapper_right i").css("display", "none");
            $('#monkeyresults_right').html(html);
            $("#monkeytalk_right").html("LDAP svarade... se resultatet här nedanför");
        })
            .catch(function (error) {
            api_error(error.response);
        })
            .then(function () {
        });
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
        var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
        var enamn3 = enamn2.replace(/æ/g, "ae") // ersätt eventuella æ med ae i namnen före sökning. Leta KTH-anställda spricker annars
        var url = letaanstallda_apiurl + "users?fname=" +
            fnamn2 +
            "%&ename=" +
            enamn3 +
            "%" +
            "&api_key=" + letaanstallda_apikey;
        axios.get(url)
            .then(function (response) {
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
                        console.log(json);
                    });
                }
            }

            html += '</div>'
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyresults').html(html);
            $("#monkeytalk").html("Leta KTH-anställda svarade... se resultatet här nedanför");
        })
            .catch(function (error) {
            api_error(error.response);
        })
            .then(function () {
        });
    }

    /**
     * Hämta info från Scopus
     *
     * @param {*} doi
     */

    async function getScopus(doi) {
        if(doi == ""){
            $('#monkeytalk').html('Ojojoj, ingen DOI!');
            $("#monkeyresultswrapper i").css("display", "none");
            return 0;
        }
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med Scopus...");
        var url = scopus_apiurl +
            doi +
            '?apiKey=' + scopus_apikey;
        await axios.get(url)
            .then(function (response) {
            var html = '<div><div class="updateheader"></div>';
            if (response.status == 201) {
                html += "<p>Hittade inget i Scopus!</p>";
            } else {
                //hitta ScopusId
                var eid = response.data['abstracts-retrieval-response']['coredata']['eid']; //plocka värdet för ScopusId (eid)
                if(eid == "" // uppdatera bara om fältet är tomt
                   || typeof eid === 'undefined'
                   || eid == 'undefined') {
                    //                 html += '<p>ScopusID hittades inte</p>';
                } else {
                    if($("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val() == "") {
                        html += '<p style="color:green;">Uppdaterat ScopusID: ' + eid + '</p>';
                        $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
                        $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val(eid); // skriv in det i fältet för ScopusId
                    }}

                var pmid = response.data['abstracts-retrieval-response']['coredata']['pubmed-id']; //plocka värdet för PubMedID (PMID
                if(pmid == ""  // uppdatera bara om fältet är tomt
                   || typeof pmid === 'undefined'
                   || pmid == 'undefined') {
                    //                 html += '<p>PubMedID hittades inte i Scopus</p>';
                } else {
                    if($("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val() == "") {
                        html += '<p style="color:green;">Uppdaterat PubMedID: ' + pmid + '</p>';
                        $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
                    }}

                var oa = response.data['abstracts-retrieval-response']['coredata']['openaccessFlag']; // plocka openaccessFlag true or false
                if (oa == 'true') { // kolla om artikeln är OA
                    document.getElementById(diva_id + ":doiFree").checked = true; // checka boxen
                    html += '<p style="color:green;">Uppdaterat Free full-text: ' + response.data['abstracts-retrieval-response']['coredata']['openaccessFlag'] + '</p>'; // visa bara uppdatering om Free full-text = 'true'
                } else {
                    ""; // checka inte boxen
                }
                $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
                $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!

            };
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyupdates').html(html + $('#monkeyupdates').html());
            $("#monkeytalk").html("Titta här nedanför för att se om jag uppdaterat något.");
            return 1;
        })
            .catch(function (error) {
            $("#monkeyresultswrapper i").css("display", "none");
            $("#monkeytalk").html("Jag hittade inget i Scopus!");
        })
            .then(function () {
        });
    }

    /**
     * Hämta info från Web of Science
     *
     * @param {*} doi
     */

    async function getWoS(doi) {
        var api_wos_xml = '<?xml version="1.0" encoding="UTF-8" ?><request xmlns="http://www.isinet.com/xrpc42" src="app.id=API"><fn name="LinksAMR.retrieve"><list><map><val name="username">' + monkey_config.api_username_wos + '</val><val name="password">' + monkey_config.api_password_wos + '</val></map><!-- WHAT IS REQUESTED --><map><list name="WOS"><val>timesCited</val><val>ut</val><val>doi</val><val>pmid</val><val>sourceURL</val><val>citingArticlesURL</val><val>relatedRecordsURL</val></list></map><!-- LOOKUP DATA --><map><!-- QUERY "cite_1" --><map name="cite_1"><val name="doi">' + doi + '</val></map> <!-- end of cite_1--></map><!-- end of citations --></list></fn></request>';
        console.log(api_wos_xml)
        if(doi == ""){
            $('#monkeytalk').html('Ojojoj, ingen DOI! Jag behöver en DOI för att kunna uppdatera från databaserna.');
            $("#monkeyresultswrapper i").css("display", "none");
            return 0;
        }
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med Web of Science...");
        var url = monkey_config.wos_api_url;
        await axios.get(url, api_wos_xml, {headers: {'Content-Type': 'text/xml'}})
            .then(function (response) {
            var html = '<div><div class="updateheader"></div>';
            if (response.status == 201) {
                html += "<p>Hittade inget i Web of Science</p>";
            } else {
                var isi = response.data.wos.ut; //plocka värdet för ISI/UT
                if(isi == ""  // uppdatera bara om fältet är tomt
                   || typeof isi === 'undefined'
                   || isi == 'undefined') {
                    //                 html += '<p>ISI hittades inte</p>';
                } else {
                    if($("div.diva2addtextchoicecol:contains('ISI')").parent().find('input').val() == "") {
                        html += '<p style="color:green;">Uppdaterat ISI: ' + isi + '</p>';
                        $("div.diva2addtextchoicecol:contains('ISI')").parent().find('input').val(isi); // skriv in värdet för ISI/UT i fältet för ISI
                    }}

                var pmid = response.data.wos.pmid; //plocka värdet för PubMedID (PMID
                if(pmid == ""
                   || typeof pmid === 'undefined'
                   || pmid == 'undefined') {
                    //                  html += '<p>PubMedID hittades inte i Web of Science</p>';
                } else {
                    if($("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val() == "") {
                        html += '<p style="color:green;">Uppdaterat PubMedID: ' + pmid + '</p>';
                        $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
                    }}
                $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
                $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
            };
            $("#monkeyresultswrapper i").css("display", "none");
            $('#monkeyupdates').html(html + $('#monkeyupdates').html());
            $("#monkeytalk").html("Titta här nedanför för att se om jag uppdaterat något.");
        })
            .catch(function (error) {
            $("#monkeyresultswrapper i").css("display", "none");
            $("#monkeytalk").html("Jag hittade inget i Web of Science");
        })
            .then(function () {
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
        var url = diva_searchurl + '?format=' + format + '&addFilename=true&aq=[[{"titleAll":"' +
            titleAll.replace("?", "") + '"}]]&aqe=[]&aq2=[[]]&onlyFullText=false&noOfRows=50&sortOrder=title_sort_asc&sortOrder2=title_sort_asc'; // av någon anledning fixar inte sökningen titlar som innehåller eller i alla fall slutar med ett "?"
        await axios.get(url)
            .then(function (response) {
            var html = '<div><div class="resultsheader">Information från DiVA, Söktext: ' + '<br /><br />' + titleAll + '</div>';
            if (response.data) {
                var json = response.data
                console.log($(response.data).find('mods'))
                if ($(response.data).find('mods').length == 0) {
                    html += '<div><span class="fieldtitle"><br /><p style="color:green;">Jag hittade ingenting!<br />Det finns sannolikt ingen dubblett!</p></span></div></div>';
                } else {
                    $(response.data).find('mods').each(function(i, j) {
                        html += '<div class="inforecord flexbox column">';
                        html += '<h2><p style="color:red;">ID: ' + $(j).find('recordIdentifier').text() +'</p></h2>';
                        html += '<div><span class="fieldtitle">Status (artiklar): </span><span>' + $(j).find('note[type="publicationStatus"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">URI: </span><span><a href="' + $(j).find('identifier[type="uri"]').text() + '" target="_new">' + $(j).find('identifier[type="uri"]').text() + '</a></span></div>' +
                            //   '<div><span class="fieldtitle">Publiceringsstatus<br/>(artiklar): </span><span>' + $(j).find('note[type="publicationStatus"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">Publikationstyp: </span><span>' + $(j).find('genre[authority="diva"][type="publicationType"][lang="swe"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">DOI: </span><span>' + $(j).find('identifier[type="doi"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">ISI: </span><span>' + $(j).find('identifier[type="isi"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">ScopusID: </span><span>' + $(j).find('identifier[type="scopus"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">PMID: </span><span>' + $(j).find('identifier[type="pmid"]').text() + '</span></div>' +
                            //                            '<div><span class="fieldtitle">Created: </span><span>' + $(j).find('recordCreationDate').text() + '</span></div>' +
                            //                            '<div><span class="fieldtitle">Changed: </span><span>' + $(j).find('recordChangeDate').text() + '</span></div>' +
                            //                            '<div><span class="fieldtitle">Origin: </span><span>' + $(j).find('recordOrigin').text() + '</span></div>' +
                            //                            '<div><span class="fieldtitle">Source: </span><span>' + $(j).find('recordContentSource').text() + '</span></div>' +
                            '<div><span class="fieldtitle"><img class="oa" src="https://apps.lib.kth.se/divaapan/oa.png"> Publicerad version: </span><span><a href="' + $(j).find('url[displayLabel="fulltext:print"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext:print"]').text() + '</p>' + '</a></span></div>' +
                            '<div><span class="fieldtitle"><img class="oa" src="https://apps.lib.kth.se/divaapan/oa.png"> Preprint: </span><span><a href="' + $(j).find('url[displayLabel="fulltext:preprint"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext:preprint"]').text() + '</p>' + '</a></span></div>' +
                            '<div><span class="fieldtitle"><img class="oa" src="https://apps.lib.kth.se/divaapan/oa.png"> Postprint: </span><span><a href="' + $(j).find('url[displayLabel="fulltext:postprint"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext:postprint"]').text() + '</p>' + '</a></span></div>' +
                            '<div><span class="fieldtitle"><img class="oa" src="https://apps.lib.kth.se/divaapan/oa.png"> Ospec: </span><span><a href="' + $(j).find('url[displayLabel="fulltext"]').text() + '" target="_new">' + '<p style="color:red;">' + $(j).find('url[displayLabel="fulltext"]').text() + '</p>' + '</a></span></div>' +
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
            .catch(function (error) {
            $("#monkeyresultswrapper i").css("display", "none");
            $("#monkeytalk").html("Jag hittade inget i DiVA");
        })
            .then(function () {
        });
    }

    /**
     * Funktion för att anropa DBLP och hämta information via DOI
     *
     * @param {string} doi
     */

    function getDblp(doi) {
        if(doi == ""){
            $('#monkeyresults').html('DBLP: Ingen DOI finns!');
            $("#monkeyresultswrapper i").css("display", "none");
            return;
        }
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $("#monkeytalk").html("Jag pratar med DBLP...");
        var url = dblp_apiurl1 + doi;
        axios.get(url)
            .then(function (response) {
            var html = '<div><div class="resultsheader">Information från dblp, DOI: ' + doi + '</div>';
            if ($(response.data).find("crossref").text()) {
                var url = dblp_apiurl2 + $(response.data).find("crossref").text();
                axios.get(url)
                    .then(function (response) {
                    //                    html += '<div class="inforecord flexbox column">';
                    html += '<br /><div style="color:green;"><span class="fieldtitle">Title: </span><span>' + $(response.data).find("title").text() + '</span></div>' +
                        '<br /><div style="color:green;"><span class="fieldtitle">Series: </span><span>' + $(response.data).find("series").text() + '</span></div>' +
                        '<br /><div style="color:green;"><span class="fieldtitle">Volume: </span><span>' + $(response.data).find("volume").text() + '</span></div>'
                    html += '</div>';
                    $("#monkeyresultswrapper i").css("display", "none");
                    $('#monkeyresults').html(html);
                    $("#monkeytalk").html("dblp svarade... se resultatet här nedanför!");
                })
                    .catch(function (error) {
                    api_error(error.response);
                })
                    .then(function () {
                });
            } else {
                html += "<p>Hittade inget hos dblp</p>";
            }
        })
            .catch(function (error) {
            $('#monkeyresults').html('');
            $("#monkeyresultswrapper i").css("display", "none");
            $("#monkeytalk").html("Nej, jag hittade inget i dblp. Det kanske inte är ett konferensbidrag inom Computer Science?");
        })
            .then(function () {
        });
    }

    /**
     * Funktion för att anropa Crossref och hämta information via DOI
     *
     * @param {string} doi
     */

    function getCrossref(doi) {
        //          var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
        if(doi != ""){
            var url = 'https://api.crossref.org/works/' + doi + '/transform/application/vnd.crossref.unixsd+xml';
            axios.get(url)
                .then(function (response) {
                var publisher = $(response.data).find('crm-item[name="publisher-name"]').text(); // hämtar förlagsinformation
                var publisher_edited = publisher.replace(/Springer Science and Business Media LLC/g, "Springer Nature");
                $("div.diva2addtextchoicecol:contains('Annat förlag') , div.diva2addtextchoicecol:contains('Other publisher')").parent().find('input').val(publisher_edited); // klistrar in förlagsinfo från Crossref
            })
        }
    }

    /**
     * Funktion för att anropa Crossref och volume/issue/pages via DOI
     *
     * @param {string} doi
     */

    function getCrossrefVol(doi) {
        //          var doi = $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val();
        if(doi != ""){
            var url = 'https://api.crossref.org/works/' + doi + '/transform/application/vnd.crossref.unixsd+xml';
            axios.get(url)
                .then(function (response) {
                var year = $(response.data).find('journal_issue').find('publication_date').find('year').last().text(); // hämtar year, svårt här, ibland två st year - tar det sista
                var volume = $(response.data).find('journal_volume').find('volume').text(); // hämtar volume
                var issue = $(response.data).find('journal_issue').find('issue').text(); // hämtar issue
                var first_page = $(response.data).find('journal_article').find('pages').find('first_page').text(); // hämtar första sidan
                var last_page = $(response.data).find('journal_article').find('pages').find('last_page').text(); // hämtar sista sidan
                var isbn = $(response.data).find('proceedings_metadata').find('isbn').text(); // hämtar isbn (finns det flera...?)

                if($(response.data).find('journal_issue').find('publication_date').find('year').text() != "") {  // om det inte finns några uppgifter hos Crossref klistras inget in
                    $("div.diva2addtextchoicecol:contains('Year:') , div.diva2addtextchoicecol:contains('År:')").next().find('input').val(year); // klistrar in år från Crossref
                }
                if($(response.data).find('journal_volume').find('volume').text() != "") {  // om det inte finns några uppgifter hos Crossref klistras inget in
                    $("div.diva2addtextchoicecol:contains('Volume:') , div.diva2addtextchoicecol:contains('Volym:')").next().find('input').val(volume); // klistrar in volym från Crossref
                }
                if($(response.data).find('journal_issue').find('issue').text() != "") {  // om det inte finns några uppgifter hos Crossref klistras inget in
                    $("div.diva2addtextchoicecol:contains('Number:') , div.diva2addtextchoicecol:contains('Nummer:')").next().find('input').val(issue); // klistrar in nummer från Crossref
                }
                if($(response.data).find('journal_article').find('pages').find('first_page').text() != "") {  // om det inte finns några uppgifter hos Crossref klistras inget in
                    $("div.diva2addtextchoicecol:contains('Pages:') , div.diva2addtextchoicecol:contains('Sidor:')").next().find('input').first().val(first_page); // klistrar in första sidan från Crossref
                }
                if($(response.data).find('journal_article').find('pages').find('last_page').text() != "") {  // om det inte finns några uppgifter hos Crossref klistras inget in
                    $("div.diva2addtextchoicecol:contains('Pages:') , div.diva2addtextchoicecol:contains('Sidor:')").next().find('input').next().val(last_page); // klistrar in första sidan från Crossref
                }
                if($(response.data).find('proceedings_metadata').find('isbn').text() != "") {  // om det inte finns några uppgifter hos Crossref klistras inget in
                    $("div.diva2addtextchoicecol:contains('ISBN')").next().find('input').val(isbn); // klistrar in isbn från Crossref FUNKAR BARA OM MAN KLICKAR TVÅ GGR PÅ KNAPPEN ARGH!!
                }
            })
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
            getDiVA($maintitleiframe.contents().find("body").html().replace(/&nbsp;/g, " ").replace(/\?/g, ""), 'mods');  // ta bort saker som innehåller "&" och "?" som sökningen inte klarar av
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

        ////////////////////////////////////
        //
        // Knappar vid "Annan serie"/"Other series" - ISSN
        //
        ////////////////////////////////////

        if($("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(0).val() != "") {    // ingen mening att visa knappar om det inte står något i fältet
            $('#issnTitleButtonjq').remove();
            var issnTitleButtonjq = $('<button class="link" id="issnTitleButtonjq" type="button">Öppna i ISSN Portal på serietitel</button>');
            issnTitleButtonjq.on("click", function() {
                var url = "https://portal.issn.org/api/search?search[]=MUST=default=" +
                    $("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(0).val() +
                    "";
                window.open(url, '_blank');
            })}
        else {}
        $("div.diva2addtextchoicecol:contains('Title of series:'), div.diva2addtextchoicecol:contains('Seriens namn:')").before(issnTitleButtonjq)

        if($("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(1).val() != "") {   // ingen mening att visa knappar om det inte står något i fältet
            $('#issnButtonjq').remove();
            var issnButtonjq = $('<button class="link" id="issnButtonjq" type="button">Öppna i ISSN Portal på ISSN</button>');
            issnButtonjq.on("click", function() {
                var url = "https://portal.issn.org/api/search?search[]=SHOULD=allissnbis=%22" +
                    $("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(1).val() + "%22" +
                    "&search[]=SHOULD=allissnbis=%22" + $("div.diva2addtextchoicecol:contains('ISSN')").parent().find('input').eq(2).val() +
                    "%22";
                window.open(url, '_blank');
            })}
        else {}
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
        wosapiButtonjq.on("click", function() {
            getWoS($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
        })
        $("div.diva2addtextchoicecol:contains('ISI')").before(wosapiButtonjq)

        ////////////////////////////////////
        //
        // Sökning på ScopusId i Scopus webbgränssnitt
        //
        ////////////////////////////////////

        $('#openScopusButtonjq').remove();
        var openScopusButtonjq = $('<button class="link" id="openScopusButtonjq" type="button">Öppna i Scopus</button>');
        openScopusButtonjq.on("click", function() {
            var url = "https://focus.lib.kth.se/login?url=http://www.scopus.com/record/display.url?origin=inward&partnerID=40&eid=" +
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

        if($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val() == "") {  // bara om det saknas en DOI
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
        // Uppdatera fält från Scopus
        //
        ////////////////////////////////////

        $('#scopusButtonjq').remove();
        var scopusButtonjq = $('<button id="scopusButtonjq" type="button">Uppdatera från Scopus</button>');
        scopusButtonjq.on("click", function() {
            getScopus($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
        })
        $("div.diva2addtextchoicecol:contains('ScopusID')").before(scopusButtonjq)

        ////////////////////////////////////
        //
        // Uppdatera förlagsfält från Crossref
        //
        ////////////////////////////////////

        if(doi != ""){  // bara om det finns en DOI, annars är det meningslöst
            $('#crossrefButtonjq').remove();
            var crossrefButtonjq = $('<button id="crossrefButtonjq" type="button">Uppdatera förlag från Crossref</button>');
            crossrefButtonjq.on("click", function() {
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

        if(doi != ""){  // bara om det finns en DOI, annars är det meningslöst
            $('#crossrefVolButtonjq').remove();
            var crossrefVolButtonjq = $('<button id="crossrefVolButtonjq" type="button">Uppdatera detaljer från Crossref</button>');
            crossrefVolButtonjq.on("click", function() {
                getCrossrefVol($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
            })
            $("div.diva2addtextchoice2:contains('Övriga uppgifter') , div.diva2addtextchoice2:contains('Other information') ").parent().before(crossrefVolButtonjq);
        }

        ///////////////////////////////////////////////////
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
            //     console.log(title);
            //     console.log(keywords);
            //     console.log(abstract);
            $.ajax({
                url: 'https://bibliometri.swepub.kb.se/api/v1/classify/',
                contentType: 'application/json',
                dataType: 'JSON',
                type: 'post',
                data: JSON.stringify({ abstract: abstract,
                                      classes: 3,
                                      keywords: keywords,
                                      level: 5,
                                      title: title
                                     }),
                success: function(response){
                    console.log(response);
                    var json = response.data;
                    var html = '<div><div class="resultsheader">Klassning från Swepub</div><br /><div> Värde: ' + JSON.stringify(response.suggestions[0].score) + '</div>';
                    html+= '<div>Ämne:  ' + JSON.stringify(response.suggestions[0].swe.prefLabel) +  '</div><br />';
                    html+= '<div>Ämnesträd:  ' + JSON.stringify(response.suggestions[0].swe._topic_tree).replace(/\\/g, "").replace(/"\[/g, "").replace(/\]"/g, "") +  '</div><br />';
                    if (response.suggestions[1] !== undefined) {
                        html+= '<div>Värde: ' + JSON.stringify(response.suggestions[1].score) + '</div>';
                        html+= '<div>Ämne:  ' + JSON.stringify(response.suggestions[1].swe.prefLabel) +  '</div><br />'
                        html+= '<div>Ämnesträd:  ' + JSON.stringify(response.suggestions[1].swe._topic_tree).replace(/\\/g, "").replace(/"\[/g, "").replace(/\]"/g, "") +  '</div><br />' };
                    if (response.suggestions[2] !== undefined) {
                        html+= '<div>Värde: ' + JSON.stringify(response.suggestions[2].score) + '</div>';
                        html+= '<div>Ämne:  ' + JSON.stringify(response.suggestions[2].swe.prefLabel) +  '</div><br />'
                        html+= '<div>Ämnesträd:  ' + JSON.stringify(response.suggestions[2].swe._topic_tree).replace(/\\/g, "").replace(/"\[/g, "").replace(/\]"/g, "") +  '</div><br />' };

                    $("#monkeyresultswrapper_right i").css("display", "none");
                    $('#monkeyresults_right').html(html);
                    $("#monkeytalk").html("Swepub svarade... se resultatet här nedanför");

                }
            })

        })

        $("div.diva2addtextchoice2:contains('Nationell ämneskategori') , div.diva2addtextchoice2:contains('National subject category')").parent().before(classButtonjq);

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
        // Knapp och länk till hjälpsida i Confluence
        //
        /////////////////////////////////////////////////////

        $('#helpButtonjq').remove();
        var helpButtonjq = $('<button class="link" id="helpButtonjq" type="button">Hjälp</button>');
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
        // Knapp och länk till extern sökning i KTH webb-DiVA för att se eventuella dubbletter
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////

        $('#dubblettButtonjq').remove();
        var dubblettButtonjq = $('<button class="link" id="dubblettButtonjq" type="button">Dubblett?</button>');
        //bind en clickfunktion som anropar DiVA KTH:s webbgränssnitt och söker på titel
        dubblettButtonjq.on("click", function() {
            var title = $("div.diva2addtextchoicebr:contains('Title'), div.diva2addtextchoicebr:contains('Titel')").parent().find('textarea').eq(0).val();
            var newtitle = title.replace("?", "") // av någon anledning fixar inte sökningen titlar som innehåller eller i alla fall slutar med ett "?"
            var url = "https://kth.diva-portal.org/smash/resultList.jsf?dswid=-4067&language=en&searchType=RESEARCH&query=&af=%5B%5D&aq=%5B%5B%7B%22titleAll%22%3A%22" +
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
                $iframe.contents().find("body p").html($iframe.contents().find("body p").html()+ QC);
            });
        })
        $('#' + diva_id + '\\:notes').after(qcclearButton)


        ///////////////////////////////////////////////////////////////////////////////////
        //
        // Funktion för att skapa en knapp vid "Annan organisation" för varje författare,
        // för att sedan kunna radera detta fält när vi kopplat en KTH-person
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
            if(!($(thiz).next().find('input').val().includes(";"))) { // vi vill inte ta bort hela "Annan organisation"-fältet som innehåller icke-KTH-affilieringar, d.v.s. de som har ett semikolon i sig
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
            var neworg2 = neworg.replace(/Bracke/g, "Bräcke").replace(/Skondal/g, "Sköndal").replace(/Hogskola/g, "Högskola").replace(/Linkoping/g, "Linköping").
            replace(/Malardalen/g, "Mälardalen").replace(/Orebro/g, "Örebro").replace(/Vasteras/g, "Västerås").replace(/Goteborg/g, "Göteborg").replace(/Norrkoping/g, "Norrköping").
            replace(/Vaxjo/g, "Växjö").replace(/Umea/g, "Umeå").replace(/Lulea/g, "Luleå").replace(/Ostersund/g, "Östersund").replace(/Trollhattan/g, "Trollhättan").
            replace(/Jonkoping/g, "Jönköping").replace(/Malmo/g, "Malmö").replace(/Sodertorn/g, "Södertörn").replace(/Gavle/g, "Gävle").replace(/Skovde/g, "Skövde").
            replace(/Boras/g, "Borås").replace(/Sodertalje/g, "Södertälje").replace(/Borlange/g, "Borlänge").replace(/Harnosand/g, "Härnösand").replace(/Skelleftea/g, "Skellefteå").
            replace(/Sjofart/g, "Sjöfart").replace(/Molnlycke/g, "Mölnlycke").replace(/Domsjo/g, "Domsjö").replace(/Varobacka/g, "Väröbacka").replace(/Sodra Innovat/g, "Södra Innovat").
            replace(/Nykoping/g, "Nyköping").replace(/Ornskoldsvik/g, "Örnsköldsvik").replace(/Molndal/g, "Mölndal").replace(/Upplands Vasby/g, "Upplands Väsby").
            replace(/Lowenstromska/g, "Löwenströmska").replace(/Skarholmen/g, "Skärholmen").replace(/Lantmateri/g, "Lantmäteri");
            $(thiz).next().find('input').val(neworg2);
            if(neworg != neworg2) {
                html += '<div><p style="color:green;">Uppdaterat "Annan Organisation"</p></div>';
                console.log(neworg2);
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
            $('#ldapButtonjq' + i).remove();
            var ldapButtonjq = $('<button id="ldapButtonjq' + i + '" type="button">LDAP-info</button>');
            ldapButtonjq.on("click", function() {
                getLDAP($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val(),'');
            })
            $(this).before(ldapButtonjq)

            //Leta KTH-anställda
            $('#letaButtonjq' + i).remove();
            var letaButtonjq = $('<button id="letaButtonjq' + i + '" type="button">Leta KTH-anställda</button>');
            letaButtonjq.on("click", function() {
                getLeta($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
            })
            $(this).before(letaButtonjq)

            //Sök i ORCiD
            $('#orcidButtonjq' + i).remove();
            var orcidButtonjq = $('<button id="orcidButtonjq' + i + '" type="button">Sök i ORCiD</button>');
            orcidButtonjq.on("click", function() {
                getOrcid($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
            })
            $(this).before(orcidButtonjq);

            //KTH Intranät förnamn efternamn
            $('#kthintraButtonjq' + i).remove();
            var kthintraButtonjq = $('<button class="link" id="kthintraButtonjq' + i + '" type="button">KTH Intra</button>');
            kthintraButtonjq.on("click", function() {
                var url = "https://www.kth.se/search?q=" +
                    $(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val() +
                    "%20" +
                    $(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val() +
                    "&urlFilter=https://intra.kth.se&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
                var newurl = url.replace("$$$", "") // ta bort eventuella $$$ från efternamnen före sökning
                var newurl2 = newurl.replace(/[A-Z]\./g, "") // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i KTH Intra
                window.open(newurl2, '_blank'); // sök på förnamn efternamn på KTH Intranät
            })
            $(this).before(kthintraButtonjq)

            //Google.com förnamn + efternamn + KTH
            $('#googleButtonjq' + i).remove();
            var googleButtonjq = $('<button class="link" id="googleButtonjq' + i + '" type="button">Google</button>');
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
            $('#ldapButtonjq' + i).remove();
            var ldapButtonjq = $('<button id="ldapButtonjq' + i + '" type="button">LDAP-info</button>');
            ldapButtonjq.on("click", function() {
                getLDAP($(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val(),'');
            })
            $(this).before(ldapButtonjq)

            //Leta KTH-anställda
            $('#letaButtonjq' + i).remove();
            var letaButtonjq = $('<button id="letaButtonjq' + i + '" type="button">Leta KTH-anställda</button>');
            letaButtonjq.on("click", function() {
                getLeta($(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val());
            })
            $(this).before(letaButtonjq)

            //Sök i ORCiD
            $('#orcidButtonjq' + i).remove();
            var orcidButtonjq = $('<button id="orcidButtonjq' + i + '" type="button">Sök i ORCiD</button>');
            orcidButtonjq.on("click", function() {
                getOrcid($(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val());
            })
            $(this).before(orcidButtonjq);

            //KTH Intranät förnamn efternamn
            $('#kthintraButtonjq' + i).remove();
            var kthintraButtonjq = $('<button class="link" id="kthintraButtonjq' + i + '" type="button">KTH Intra</button>');
            kthintraButtonjq.on("click", function() {
                var url = "https://www.kth.se/search?q=" +
                    $(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val() +
                    "%20" +
                    $(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val() +
                    "&urlFilter=https://intra.kth.se&filterLabel=KTH%20Intran%C3%A4t&entityFilter=kth-profile,kth-place,%20kth-system"
                var newurl = url.replace("$$$", "") // ta bort eventuella $$$ från efternamnen före sökning
                var newurl2 = newurl.replace(/[A-Z]\./g, "") // ta bort allt som ser ut som en VERSAL med en punkt efter, typ förnamn från Scopus. Verkar ge bättre resultat med bara efternamn vid sökning i KTH Intra
                window.open(newurl2, '_blank'); // sök på förnamn efternamn på KTH Intranät
            })
            $(this).before(kthintraButtonjq)

            //Google.com förnamn + efternamn + KTH
            $('#googleButtonjq' + i).remove();
            var googleButtonjq = $('<button class="link" id="googleButtonjq' + i + '" type="button">Google</button>');
            googleButtonjq.on("click", function() {
                var url = "https://www.google.com/search?q=KTH+" +
                    $(thiz).find('.diva2addtextplusname input[id$="editorGiven"]').val() +
                    "+" +
                    $(thiz).find('.diva2addtextplusname input[id$="editorFamily"]').val()
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
        // T ex från Scopus, WoS, Sök i DiVA (efter potentiella dubbletter)
        //
        // Kör inte om det är en re_init t ex koppla personpost
        /////////////////////////////////////////////////////////////////////////////////////////////////////////

        if (re_init!=true) {
            getLDAP('', '', $('.diva2identifier:eq(2)').html())
                .then( function(result)  {
                getScopus($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val())
                    .then( function(result) {
                    getWoS($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val())
                        .then( function(result) {
                        $('html, body').animate({scrollTop:0},'slow');

                        /////////////////////////////////////////////////////////////////////////////////////////////////////////
                        //
                        // Öppna DiVA och kolla efter dubbletter när en post öppnas.
                        //
                        /////////////////////////////////////////////////////////////////////////////////////////////////////////

                        $maintitleiframe = $("div.diva2addtextchoicecol:contains('Huvudtitel:') , div.diva2addtextchoicecol:contains('Main title:')").parent().next().find('iframe').first();
                        getDiVA($maintitleiframe.contents().find("body").html().replace(/&nbsp;/g, " ").replace(/\?/g, "").replace(/["]+/g, ""), 'mods'); // ta bort saker som innehåller & och ? och " som sökningen inte klarar av
                    });
                });
            });

            /////////////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // Gå till Crossref API och hämta saker automatiskt - skall komma om knappen vid "Other publisher" faller användarna i smaken
            //
            /////////////////////////////////////////////////////////////////////////////////////////////////////////

        }
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
           '<img class="logo" src="https://apps.lib.kth.se/divaapan/apa.jpg">' +
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
           //                '<div>' +
           //                    '<img class="logo" src="https://apps.lib.kth.se/divaapan/apa.jpg">' +
           //                    '<div class="bubble">' +
           //                        '<i class="fa fa-spinner fa-spin"></i>' +
           //                        '<div id="monkeytalk_right"></div>' +
           //                    '</div>' +
           //                '</div>' +
           '<div class="monkeyheader">' +
           //                    '<h1>DiVA-Apan</h1>' +
           '</div>' +
           //'<h2>' +
           //'Uppdateringar' +
           //'</h2>' +
           //'<div id="monkeyupdates_right" class="flexbox column">' +
           //'</div>' +
           //'<hr class="solid">' +
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
    } else {
        diva_id = "addForm";
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
