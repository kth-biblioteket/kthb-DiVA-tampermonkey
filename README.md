## DiVA-apan 2020-05-27 (1.1.14)

<img src="https://apps.lib.kth.se/divaapan/apa.jpg" align="left" width="70" >

DiVA-apan ligger som ett överliggande lager över det normala DiVA-gränssnittet. I grund och botten är det insticksmodulen [TamperMonkey](https://www.tampermonkey.net/) och en för KTHB specialskriven kod som gör jobbet. Det yttersta syftet med DiVA-apan är att minimera antalet klick, antalet och byten av olika fönster, manuell inskrivning av uppgifter; kort sagt att spara tid och pengar. En stor del av koden kan utan svårighet anpassas till andra DiVA-biblioteks behov. De KTHB-specifika delarna torde vara uppenbara. Egentligen rör sig dessa specifika delar bara om kopplingen till KTHs LDAP samt den lokala databasen över KTH-forskare. Funktioner programmerade mot Web of Science och Scopus API:er bör vara enkla att kopiera även för andra bibliotek och organisationer om API-nycklarna läggs in direkt i koden istället för som hos oss, hämtas från ett lokalt API skyddat med en KTH-inloggning.

#### Vad gör DiVA-apan?

##### När en post öppnas vid import eller redigering sker detta *automatiskt*:

- Hämtar och skriver in ISI/UT respektive ScopusId från Web of Science och Scopus API:er, samt en uppdateraring av OA-status.
- Snyggar till Linkoping till Linköping och Varobacka till Väröbacka etc.
- Kollar om det finns en post med samma titel i DiVA redan (misstänkt dubblett?). Mycket nyttig funktion. Dubbletter suger!
- Visar om den post som är en misstänkt dubblett har en fulltext eller ej, samt version av denna fulltext i förekommande fall.

##### Vid varje författarpost finns det knappar för att:

- Slå upp författare i KTHs lokala LDAP och visar titel, student/anställd samt epostadress.
- Slå upp författare i ett lokalt register över aktiva forskare där KTH-id, institutionstillhörighet samt ev. ORCiD finns angiven.
- Slå upp författare i ORCiD.
- Söka efter författarens för- och efternamn på KTHs Intranät.
- Söka efter författaren i Google på för- och efternamn + "KTH".
- Vid "Annan organisation" finns en knapp som vid ett musklick tar bort det som står i fältet.
- Om det finns två eller flera affilieringar i fältet "Annan organisation", d.v.s. det finns ett semikolon som separator, syns inte denna knapp varför redigering måste ske för hand. Vi tar bort KTH-affilieringen och låter de övriga stå kvar.

##### Vid titelfälten finns knappar för att:

- Sära på huvud- och undertitel vid  ":"  ifall dessa felaktigt är inskrivna i huvudtitelfältet.
- Ändra versaler till gemener förutom den första bokstaven.

##### Vid konferensfältet finns knappar för att:

- Söka upp konferens på DOI i [dblp](https://dblp.uni-trier.de/) och returnera titel på proceedings (vilken brukar innehålla konferensnamnet på ett mycket tydligt sätt). Dessutom kommer eventuell serie och volym i serie på köpet, t.ex. [LNCS](https://www.springer.com/gp/computer-science/lncs). dblp är en specialdatabas huvudsakligen för Computer Science.
- Söka på konferensens namn i Google.

##### Vid fältet "Annan serie" finns knappar för att:

- Söka på titel i [ISSN Portal](https://portal.issn.org/) för att t .ex. hitta ISSN och e-ISSN.
- Söka på ISSN och e-ISSN i ISSN Portal för att hitta fler ISSN eller en redigare serietitel.

##### Vid fältet för ISBN finns knappar som:

- Tar bort felaktigt placerade bindestreck (vilket gör att DiVA inte accepterar numret).
- Söker på ISBN i [WorldCat](https://www.worldcat.org/) för att hitta en redigare titel.

##### Vid fältet för "Annat förlag" finns en knapp som:

- Hämtar hem snyggare förlagsinformation från Crossref API, istället för de versala horrörerna som kommer från Web of Science.

##### Vid identifierarfälten (DOI, ISI/UT, ScopusId, PMID) finns knappar för att:

- Uppdatera posten via Web of Science och Scopus API:er (samma funktion som görs automatiskt när man öppnar en post).
- Öppna posten på identifierare i respektive databas webbgränssnitt.
- Söka på titel i [Crossrefs](https://search.crossref.org/) webbgränssnitt i de fall det inte finns någon DOI (ännu).

##### Vid nyckelordsfältet finns en knapp som:

- Ersätter felaktiga separatorn semikolon med kommatecken.

##### Vid Anmärkningsfältet finns knappar som:

- Klistrar in QC + dagens datum, vilket är KTHBs sätt att ange att posten ifråga är granskad.
- Tar bort det som står i fältet samt klistrar in QC + dagens datum (mest för Scopus-poster som kan innehålla ganska mycket skräp i anmärkningsfältet efter import).

##### To Do

- Crossref API, som nu endast används för förlagsinformation, öppnar oändliga möjligheter att berika data, t.ex. finansiärsinfo.
- Automatiska förslag på ämnesklassificering via det kommande Swepub-APIet.
- Ta bort copyright-info från abstractet. 
- Klistra in valfri information som finns "till vänster" automatiskt, i rätt fält vid dubbelklick (typ KTH-id).
- På något sätt få in finansiärsinfo från Crossref.

Ap-bilden by [JohnE Sturdivant](https://www.epicentrofestival.com/monkey-face-drawing-happy-monkey-face-at-clker-monkey-face-png-clipart.html)
