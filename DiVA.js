// ==UserScript==
// @name     DiVA
// @version      1.1.1
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
// ==/UserScript==
/* global $ */
/* eslint-disable no-multi-spaces, curly */
(function() {

    ///////////////////////////////
    //
    // Variabler
    //
    ///////////////////////////////
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
        $('.monkeytalk').html('Nu blev det fel!');
    }

    /**
     * Hämta info från ORCiD
     * 
     * @param {*} fnamn 
     * @param {*} enamn 
     */
    function getOrcid(fnamn, enamn) {
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $(".monkeytalk").html("Jag pratar med ORCiD...");
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
                $(".monkeytalk").html("");
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
    function getLDAP(fnamn, enamn, kthid) {
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $(".monkeytalk").html("Jag pratar med LDAP...");
        var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
        var url = ldap_apiurl + 'users/' +
                    fnamn2 +
                    '* ' +
                    enamn2 +
                    ' *' +
                    '?token=' + ldap_apikey;
        if (kthid!= "") {
            var url = ldap_apiurl + 'kthid/' +
                    kthid +
                    '?token=' + ldap_apikey;
        }
        
        axios.get(url)
            .then(function (response) {
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
                            html += '<div class="inforecord flexbox column">';
                            html += '<div><span class="fieldtitle">Efternamn: </span><span>' + json.ugusers[key].sn + '</span></div>' +
                            '<div><span class="fieldtitle">Förnamn: </span><span>' + json.ugusers[key].givenName + '</span></div>' +
                            '<div><span class="fieldtitle">Kthid: </span><span>' + json.ugusers[key].ugKthid + '</span></div>' +
                            '<div><span class="fieldtitle">Titel: </span><span>' + json.ugusers[key].title + '</span></div>' +
                            '<div><span class="fieldtitle">Skola/org: </span><span>' + json.ugusers[key].kthPAGroupMembership + '</span></div>'
                            html += '</div>';
                        });
                        
                    }
                }
                
                html += '</div>'
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyresults').html(html);
                $(".monkeytalk").html("");
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
        $(".monkeytalk").html("Jag pratar med Leta anställda...");
        var fnamn2 = fnamn.replace(/(\.|\.\s[A-Z]\.|\s[A-Z]\.)*/g, ""); // fixar så att initialer + punkt t .ex "M. R." tas bort och endast den första initialen finns kvar utan punkt
        var enamn2 = enamn.replace("$$$", "") // ta bort $$$ från efternamnen för sökning
        var url = letaanstallda_apiurl + "users?fname=" +
                    fnamn2 +
                    "%&ename=" +
                    enamn2 +
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
            
                html += '</div>'
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyresults').html(html);
                $(".monkeytalk").html("");
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
            $('#monkeytalk').html('Scopus: Ingen DOI finns!');
            $("#monkeyresultswrapper i").css("display", "none");
            return 0;
        }
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $(".monkeytalk").html("Jag pratar med Scopus...");
        var url = scopus_apiurl +
            doi +
            '?apiKey=' + scopus_apikey;
        await axios.get(url)
            .then(function (response) {
                var html = '<div><h2>Data uppdaterad från Scopus</h2>';
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
                        $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').val(eid); // skriv in det i fältet för ScopusId
                    }
                    
                    var pmid = response.data['abstracts-retrieval-response']['coredata']['pubmed-id']; //plocka värdet för PubMedID (PMID
                    if(pmid == "" 
                        || typeof pmid === 'undefined' 
                        || pmid == 'undefined') {
                        html += '<p>PubMedID hittades inte</p>';
                    } else {
                        html += '<p>Uppdaterat PubMedID: ' + pmid + '</p>';
                        $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
                    }
                    
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
                $('#monkeyupdates').html(html + $('#monkeyupdates').html());
                $(".monkeytalk").html("");
                return 1;
            })
            .catch(function (error) {
                api_error(error.response);
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
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $(".monkeytalk").html("Jag pratar med Web of Science...");
        var url = wos_apiurl + doi;
        axios.get(url)
            .then(function (response) {
                var html = '<div><h2>Data uppdaterad från Web of Science</h2>';
                if (response.status == 201) {
                    html += "<p>Hittade inget i Web of Science</p>";
                } else {
                    var isi = response.data.wos.ut; //plocka värdet för ScopusId (eid)
                    if(isi == "" 
                        || typeof isi === 'undefined' 
                        || isi == 'undefined') {
                        html += '<p>ISI hittades inte</p>';
                    } else {
                        html += '<p>Uppdaterat ISI: ' + isi + '</p>';
                        $("div.diva2addtextchoicecol:contains('ISI')").parent().find('input').val(isi); // skriv in värdet för ISI/UT i fältet för ISI
                    }
                   
                    var pmid = response.data.wos.pmid; //plocka värdet för PubMedID (PMID
                    if(pmid == "" 
                        || typeof pmid === 'undefined' 
                        || pmid == 'undefined') {
                        html += '<p>PubMedID hittades inte</p>';
                    } else {
                        html += '<p>Uppdaterat PubMedID: ' + pmid + '</p>';
                        $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').val(pmid); // skriv in det i fältet för PubMedID
                    }
                    $("div.diva2addtextchoicecol:contains('PubMedID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
                    $("div.diva2addtextchoicecol:contains('ScopusID')").parent().find('input').focus(); // för att scopus-infon skall "fastna!
                    //$(window).scrollTop(0);
                    
                };
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyupdates').html(html + $('#monkeyupdates').html());
                $(".monkeytalk").html("");
            })
            .catch(function (error) {
                api_error(error.response);
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
    function getDiVA(titleAll, format) {
        $("#monkeyresultswrapper i").css("display", "inline-block");
        $(".monkeytalk").html("Jag pratar med DiVA...");
        var url = diva_searchurl + '?format=' + format + '&addFilename=true&aq=[[{"titleAll":"' +
            titleAll + '"}]]&aqe=[]&aq2=[[]]&onlyFullText=false&noOfRows=50&sortOrder=title_sort_asc&sortOrder2=title_sort_asc';
        axios.get(url)
        .then(function (response) {
            var html = '<div><h2>Information från DiVA, Söktext: ' + titleAll + '</h2>';
            if (response.data) {
                var json = response.data
                if (response.status == 201) {
                    html += "<p>Inga användare hittades</p>";
                } else {
                    $(response.data).find('mods').each(function(i, j) {
                        html += '<div class="inforecord flexbox column">';
                        html += '<div><span class="fieldtitle">Status: </span><span>' + $(j).find('note[type="publicationStatus"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">ID: </span><span>' + $(j).find('recordIdentifier').text() + '</span></div>' +
                            '<div><span class="fieldtitle">Note: </span><span>' + $(j).find('note[type!="publicationStatus"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">DOI: </span><span>' + $(j).find('identifier[type="doi"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">ScopusID: </span><span>' + $(j).find('identifier[type="scopus"]').text() + '</span></div>' +
                            '<div><span class="fieldtitle">Created: </span><span>' + $(j).find('recordCreationDate').text() + '</span></div>' +
                            '<div><span class="fieldtitle">Changed: </span><span>' + $(j).find('recordChangeDate').text() + '</span></div>' +
                            '<div><span class="fieldtitle">Origin: </span><span>' + $(j).find('recordOrigin').text() + '</span></div>' +
                            '<div><span class="fieldtitle">Source: </span><span>' + $(j).find('recordContentSource').text() + '</span></div>'
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
            $(".monkeytalk").html("");
        })
        .catch(function (error) {
            api_error(error.response);
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
        $(".monkeytalk").html("Jag pratar med DBLP...");
        var url = dblp_apiurl1 + doi;
        axios.get(url)
            .then(function (response) {
                var html = '<div><h2>Information från dblp, DOI: ' + doi + '</h2>';
                if ($(response.data).find("crossref").text()) {
                    var url = dblp_apiurl2 + $(response.data).find("crossref").text();
                    axios.get(url)
                        .then(function (response) {
                            html += '<div class="inforecord flexbox column">';
                            html += '<div><span class="fieldtitle">Title: </span><span>' + $(response.data).find("title").text() + '</span></div>' +
                                    '<div><span class="fieldtitle">Series: </span><span>' + $(response.data).find("series").text() + '</span></div>' +
                                    '<div><span class="fieldtitle">Volume: </span><span>' + $(response.data).find("volume").text() + '</span></div>'
                            html += '</div>';
                        })
                        .catch(function (error) {
                            api_error(error.response);
                        })
                        .then(function () {
                        });
                } else {
                    html += "<p>Inga info hittades</p>";
                }
                
                html += '</div>'
                $("#monkeyresultswrapper i").css("display", "none");
                $('#monkeyresults').html(html);
                $(".monkeytalk").html("");
            })
            .catch(function (error) {
                api_error(error.response);
            })
            .then(function () {
            });
    }

    //////////////////////////////////////////////////////////
    //
    // Bevaka uppdateringar i noden som författarna ligger i
    // Sker t ex efter "Koppla personpost"
    // Initiera apan på nytt.
    //
    ///////////////////////////////////////////////////////////
    function mutationCallback(mutations) {
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
    };

    /**
     * Funktion för att initiera Apan
     *
     */
    async function init() {
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
            getDiVA($maintitleiframe.contents().find("body").html(), 'mods');
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

        ////////////////////////////////////////
        //
        // WoS och "Clarivate" knappar vid ISI
        //
        ////////////////////////////////////////
        $('#WoSButtonjq').remove();
        var WoSButtonjq = $('<button class="link" id="WoSButtonjq" type="button">Öppna WoS</button>');
        WoSButtonjq.on("click", function() {
            var url = "https://focus.lib.kth.se/login?url=https://ws.isiknowledge.com/cps/openurl/service?url_ver=Z39.88-2004&req_id=mailto%3Apublicering%40kth.se&&rft_id=info%3Adoi%2F" +
                $("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val() +
                "";
            window.open(url, '_blank');
        })
        $("div.diva2addtextchoicecol:contains('ISI')").before(WoSButtonjq)

        $('#wosapiButtonjq').remove();
        var wosapiButtonjq = $('<button id="wosapiButtonjq" type="button" class="buttonload"><i class="fa fa-spinner fa-spin"></i>Sök WoS</button>');
        wosapiButtonjq.on("click", function() {
            getWoS($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
        })
        $("div.diva2addtextchoicecol:contains('ISI')").before(wosapiButtonjq)

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
        var j = 0;
        $(otherorg).find("div.diva2addtextchoicecol:contains('Annan organisation') , div.diva2addtextchoicecol:contains('Other organisation')").each(function() {
            var thiz = this;
            //CLEAR ORG
            $('#clearorgButtonjq' + j).remove();
            var clearorgButtonjq = $('<button class="clearbutton" id="clearorgButtonjq' + j + '" type="button">X</button>');
            //bind en clickfunktion som skall rensa fältet för "Annan organisation"
            clearorgButtonjq.on("click", function() {
                $(thiz).next().find('input').val("");
            })
            $(this).next().find('input').after(clearorgButtonjq);
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
            $('#ldapButtonjq' + i).remove();
            var ldapButtonjq = $('<button id="ldapButtonjq' + i + '" type="button">LDAP-info</button>');
            ldapButtonjq.on("click", function() {
                getLDAP($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val(),'');
            })
            $(this).before(ldapButtonjq)

            //Leta KTH-anställda
            $('#letaButtonjq' + i).remove();
            var letaButtonjq = $('<button id="letaButtonjq' + i + '" type="button">Leta anställda</button>');
            letaButtonjq.on("click", function() {
                getLeta($(thiz).find('.diva2addtextplusname input[id$="autGiven"]').val(),$(thiz).find('.diva2addtextplusname input[id$="autFamily"]').val());
            })
            $(this).before(letaButtonjq)

            //Sök i ORCiD
            $('#orcidButtonjq' + i).remove();
            var orcidButtonjq = $('<button id="orcidButtonjq' + i + '" type="button">Sök ORCiD</button>');
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

        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Hämtar diverse automatiskt när posten öppnas - det Anders kallar headless
        //
        // T ex från Scopus, WoS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        getScopus($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val())
        .then( function(result) {
            getWoS($("div.diva2addtextchoicecol:contains('DOI')").parent().find('input').val());
        });
        
        getLDAP('', '', $('.diva2identifier:eq(2)').html())
    

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
            });
        });
    }

    ///////////////////////////////////////////////////////////////////////////////////
    //
    // Huvudkod
    //
    ///////////////////////////////////////////////////////////////////////////////////
    //Overlay för att visa "popup" på sidan
    $('body.diva2margin').append($('<div id="ldapoverlay"></div>'));

    //DIV för att visa Apans resultat till vänster på sidan
    $('body.diva2margin')
    .append($('<div id="monkeyresultswrapper">' + 
                '<div>' +
                    '<img class="logo" src="https://apps.lib.kth.se/divaapan/apa.jpg">' + 
                    '<!--img class="monkeytalkbubble" src="https://apps.lib.kth.se/divaapan/monkeytalk.png"-->' +
                    '<div class="bubble">' +
                        '<i class="fa fa-spinner fa-spin"></i>' +
                        '<div class="monkeytalk"></div>' +
                    '</div>' + 
                '</div>' +
                '<div class="monkeyheader">' +
                    '<span>DiVA-Apan</span>' + 
                '</div>' +
                '<div>' +
                    'Uppdateringar' +
                '</div>' +
                '<div id="monkeyupdates" class="flexbox column">' +
                '</div>' + 
                '<hr class="solid">' +
                '<div>' +
                    'Resultat' +
                '</div>' +
                '<div id="monkeyresults" class="flexbox column">' +
                '</div>' + 
            '</div>'));

    //Visa loader...
    $("#monkeyresultswrapper i").css("display", "inline-block");
    $(".monkeytalk").html("Jag gör mig redo...");

    // Vilket DiVA-läge (edit, publish, review eller import)
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

//--CSS:
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

.monkeytalk {
    width: 150px;
}

.monkeyheader {
    font-weight: bold;
    font-size: 1.06em;
    padding-bottom: 10px;
}

#monkeyresultswrapper i {
    font-size: 32px;
    position: absolute;
    top: 18px;
    left: 170px;
    z-index: 1;
}

#wosapiButtonjq i,
#monkeyresultswrapper i {
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
    width: 300px; 
    height: 100%; 
    overflow: auto;
    padding-left: 10px;
    background: #ffffff
}

#monkeyupdates {
    height: 150px;
    overflow: auto;
}

#monkeyresults ,
#monkeyupdates {
    padding: 10px;
    font-size: 10px;
    margin-bottom: 10px;
}

#monkeyresults a, #ldapoverlay a {
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
}

button.link {
    background-color: #007fae;
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
