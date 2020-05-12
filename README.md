## DiVA-apan 2020-05-12 (1.1.12)

DiVA-apan ligger som ett överliggande lager över det normala DiVA-gränssnittet. Det som används är insticksmodulen TamperMonkey och en specialskriven kod för KTHBs behov. Det finns en stor del av koden som utan svårighet kan anpassas till andra biblioteks behov. De KTHB-specifika delarna torde vara uppenbara, egentligen bara koppling till KTHs LDAP samt den lokala databasen över forskare. Funktioner för Web of Science och Scopus bör vara enkla att kopiera för andra bibliotek och organisationer om API-nycklar läggs in direkt i koden istället för som hos oss, via ett lokalt API med inloggning.

#### Vad gör DiVA-apan?

##### När en post öppnas vid import eller redigering:

- Hämtar och skriver in ISI/UT respektive ScopusId från Web of Science och Scopus API:er, samt uppdaterar OA-status.
- Snyggar till Linkoping till Linköping och Varobacka till Väröbacka etc.
- Kollar om det finns en post med samma titel i DiVA redan (misstänkt dubblett?).
- Visar om den post som är en misstänkt dubblett har en fulltext eller ej, samt version av denna fulltext i förekommande fall.

##### Vid varje författarpost finns det knappar för att:

- Slå upp författaren i KTHs lokala LDAP
- Slå upp författaren i ett lokalt register över aktiva forskare där institutionstillhörighet samt ev. ORCiD finns.
- Slå upp författaren i ORCiD.
- Söka efter författarens namn på KTHs Intranät.
- Söka efter författaren i Google på namn + "KTH".

##### Vid titelfälten finns knappar för att:

- Sära på huvud- och undertitel vid  ":"  ifall dessa felaktigt är inskrivna i samma fält.
- Ändra versaler till gemener förutom den första bokstaven.

##### Vid konferensfältet finns knappar för att:

- Söka upp konferensen på DOI i dblp och returnerar titel på proceedings (vilken brukar innehålla konferensnamnet på ett bra sätt). Dessutom kommer eventuell serie och volym i serie på köpet, t.ex. LNCS. dblp är en specialdatabas mest för Computer Science.
- Söka på konferensens namn i Google.

##### Vid fältet "Annan serie" finns knappar för att:

- Söka på titel i ISSN Portal (för att t .ex. hitta ISSN).
- Söka på ISSN och e-ISSN i ISSN Portal (för att hitta fler ISSN eller kanske titel på serie).

##### Vid fältet för ISBN finns knappar som:

- Tar bort felaktigt placerade bindestreck (vilket gör att DiVA inte accepterar numret).
- Söker på ISBN i WorldCat.

##### Vid identifierarfälten (DOI, ISI/UT, ScopusId, PMID) finns knappar för att:

- Uppdatera posten via Web of Science och Scopus API (samma funktion som görs automatiskt när man öppnar en post).
- Öppna posten på identifierare i respektive databas webbgränssnitt.
- Söka på titel i Crossref i de fall det inte finns någon DOI (ännu).

##### Vid nyckelordsfältet finns en knapp som:

- Ersätter felaktiga separatorer (semikolon) med komma.

##### Vid Anmärkningsfältet finns knappar som:

- Klistrar in QC + dagens datum (KTHBs sätt att ange att posten är granskad)
- Tar bort det som står i fältet samt klistrar in QC + dagensdatum (för Scopus-poster vilka kan lägga in ganska mycket skräp i anmärkningsfältet).
