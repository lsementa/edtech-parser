function clearAll() {
    document.getElementById("xmlInput").value = "";
    document.getElementById("fileInput").value = "";
    const tableBody = document.getElementById("outputTable").querySelector("tbody");
    tableBody.innerHTML = "";
    document.getElementById("progressContainer").style.display = 'none';
    document.getElementById("downloadLink").style.display = 'none';
    document.getElementById("nameHeader").value = '';
    document.getElementById("contactTable").style.display = 'none';
    document.getElementById("break").style.display = 'none';
    document.getElementById("outputTable").style.display = 'table';
    document.getElementById("progressBar").style.width = '0%';
    document.getElementById("lineCount").textContent = '';
	document.getElementById("totalRecords").textContent = '';
	document.getElementById("totalRecords").style.display = 'none';
}

function formatXml(xml) {
    const PADDING = '  ';

    // Remove any existing whitespace between tags
    xml = xml.replace(/>\s+</g, '><').trim();

    let pad = 0;
    let formatted = '';
    let inTextNode = false;

    xml.split(/(<[^>]+>)/g).forEach((node) => {
        if (node.trim() === '') return; // Ignore empty nodes

        // Closing tag
        if (node.match(/^<\/\w/)) {
            pad--;
            if (!inTextNode) {
                formatted += '\n' + PADDING.repeat(pad) + node;
            } else {
                formatted += node; // Keep text and closing tag on the same line
            }
            inTextNode = false;
        }
        // Opening tag (not self-closing)
        else if (node.match(/^<\w/) && !node.match(/\/>$/)) {
            if (!inTextNode) {
                formatted += '\n' + PADDING.repeat(pad) + node;
            } else {
                formatted += node; // Append tag to existing text node
            }
            pad++;
            inTextNode = false;
        }
        // Self-closing tag
        else if (node.match(/^<\w/) && node.match(/\/>$/)) {
            formatted += '\n' + PADDING.repeat(pad) + node;
            inTextNode = false;
        }
        // Text content between tags (should stay on the same line)
        else {
            formatted += node.trim();
            inTextNode = true;
        }
    });

    return formatted.trim();
}

function prettyPrintXML() {
    const xmlInput = document.getElementById('xmlInput');
    const xmlString = xmlInput.value;

    // Apply the formatting
    const formattedXml = formatXml(xmlString);
    xmlInput.value = formattedXml;
}

function formatFileSize(size) {
    const sizeInMB = size / (1024 * 1024); // Convert bytes to megabytes
    if (sizeInMB >= 1024) {
        const sizeInGB = sizeInMB / 1024;
        return sizeInGB.toFixed(2) + ' GB';
    } else {
        return sizeInMB.toFixed(2) + ' MB';
    }
}

function parseXMLFromString(xmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, "application/xml");
}

function parse() {
    const file = document.getElementById("fileInput").files[0];
	const messageDiv = document.getElementById('messageBox');
    let parseType = "";

    if (file) {
        document.getElementById("outputTable").style.display = 'none';

        // Extract parseType from the file name
        const fileName = file.name;
        const match = fileName.match(/^([A-Z]{3,4})\d{4}-\d{2}-\d{2}T\d{2}\.\d{2}\.\d{2}\.\d{6}Z/);
        if (match) {
            parseType = match[1]; // This extracts the GRP, PRSN, CSEC, or MEMB part
        }

        if (parseType === 'GRP' || parseType === 'PRSN' || parseType === 'CSEC' || parseType === 'MEMB') {
            parseXMLFile(file, parseType);
        } else {
			messageDiv.innerText = "File must begin with PRSN, CSEC, MEMB or GRP!";
			showMessage();
        }
    } else {
        const xmlString = document.getElementById("xmlInput").value;
        document.getElementById("outputTable").style.display = 'table';

        if (xmlString.trim()) {
            const xmlDoc = parseXMLFromString(xmlString);

            // Extract parseType from the first tag in the XML input
            const firstTag = xmlDoc.documentElement.tagName;
            switch (firstTag) {
                case "gms:groupRecord":
                    parseType = "GRP";
                    break;
                case "mms:membershipRecord":
                    parseType = "MEMB";
                    break;
                case "pms:personRecord":
                    parseType = "PRSN";
                    break;
                case "cms:courseSectionRecord":
                    parseType = "CSEC";
                    break;
                default:
                    console.error('Unknown XML tag:', firstTag);
            }

            displayParsedData(xmlDoc, parseType);
            document.getElementById("progressContainer").style.display = 'none';
        }
    }

    // Pretty print the XML in the textarea
    prettyPrintXML();
	// Scroll to top of textbox
    const xmlInput = document.getElementById('xmlInput');
    xmlInput.select();
	window.getSelection().removeAllRanges();
    xmlInput.scrollTop = 0;
}

async function copy() {
    const xmlInput = document.getElementById('xmlInput');
    const xmlContent = xmlInput.value; // Get the content of the textarea
	const messageDiv = document.getElementById('messageBox');

    try {
        await navigator.clipboard.writeText(xmlContent); // Copy the content to the clipboard
		messageDiv.innerText = "XML copied to clipboard!";
        showMessage(); // Show the message div
    } catch (err) {
        console.error("Failed to copy text: ", err);
    }
}

function showMessage() {
    const messageDiv = document.getElementById('messageBox');
    messageDiv.style.display = 'block'; // Show the message
    setTimeout(() => {
        messageDiv.classList.add('hidden'); // Start fading out after a delay
        setTimeout(() => {
            messageDiv.style.display = 'none'; // Hide the element after fade-out completes
            messageDiv.classList.remove('hidden'); // Reset the class for next use
        }, 1000); // Match this timeout with the CSS transition duration
    }, 2000); // Display for 2 seconds before fading out
}

function parseXMLFile(file, parseType) {
    const CHUNK_SIZE = 3 * 1024 * 1024; // 3 MB Chunks
    let offset = 0;
    let leftover = '';
    let totalLines = 0;
    let csvContent = [];

    const decoder = new TextDecoder();
    const validTags = [
        "<pms:personRecord",
        "<gms:groupRecord",
        "<cms:courseSectionRecord",
        "<mms:membershipRecord"
    ];

    switch (parseType) {
        case "PRSN":
            csvContent.push("BUID,Form Name [Full],Form Name [Preferred],Full Name [First],Full Name [Middle],Full Name [Last],Full Name [Given],Full Name [Family],Full Name [Surname],Full Name [Suffix],Full Name [Prefix],Preferred Name [First],Preferred Name [Middle],Preferred Name [Last],Preferred Name [Given],Preferred Name [Family],Preferred Name [Surname],Preferred Name [Suffix],Preferred Name [Prefix],Email [Primary],Telephone,Telephone [Home],Telephone [Cell],Telephone [Current],Telephone [Work],Place of Birth,Date of Birth,Gender,Marital Status\n");
            break;
        case "GRP":
            csvContent.push("Source ID,Scheme,TypeValue ID,Type,Level,Org ID,Org Name,Short Description,Long Description\n");
            break;
        case "MEMB":
            csvContent.push("Source ID,Collection ID,Membership ID,BUID,Role Type,Sub Role,Time Frame,Status\n");
            break;
        case "CSEC":
            csvContent.push("Source ID,Title,ParentOffering ID,Short Description,Long Description,Status,Category,Number of Students,Max Number of Students,Academic Session,Org,Begin,End,Location,Meeting,Notes\n");
            break;
        default:
            csvContent = [];
    }

    document.getElementById("progressContainer").style.display = 'block';

    async function readNextChunk() {
        if (offset < file.size) {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const buffer = await slice.arrayBuffer();
            const textChunk = leftover + decoder.decode(buffer, { stream: true });
            const lines = textChunk.split('\n');
            leftover = lines.pop(); // Save leftover for the next chunk

            // Filter lines based on validTags and increment totalLines only for valid lines
            const validLines = lines.filter(line => validTags.some(tag => line.trim().startsWith(tag)));
            totalLines += validLines.length;

            const batchCsvContent = validLines.map(line => {
                const xmlDoc = parseXMLFromString(line);
                return extractCSVFromXML(xmlDoc, parseType);
            });
            csvContent.push(...batchCsvContent);

            const percentProcessed = Math.min((offset / file.size) * 100, 100);
            updateProgressBar(offset, file.size);
            document.getElementById("lineCount").innerHTML = `Type: ${parseType}<br>Size: ${formatFileSize(file.size)}<br>Total records: &nbsp;${totalLines.toLocaleString()} &nbsp;&nbsp;[<strong>${Math.round(percentProcessed)}%</strong>]`;

            offset += CHUNK_SIZE;
            setTimeout(readNextChunk, 1);
        } else {
            if (leftover) {
                if (validTags.some(tag => leftover.trim().startsWith(tag))) {
                    const xmlDoc = parseXMLFromString(leftover);
                    csvContent.push(extractCSVFromXML(xmlDoc, parseType));
                    totalLines++; // Increment totalLines for the leftover line
                }
            }

            createDownloadLink(csvContent.join(''), parseType, totalLines);
            document.getElementById("progressContainer").style.display = 'none';
        }
    }

    readNextChunk();
}

function parsePersonNode(personNode) {
    // Get ID from sourcedGUID > sourcedId
    const buid = personNode.getElementsByTagName("pms:sourcedId")[0]?.textContent;

    // Handle full and preferred names
    let full_name = "";
    let preferred_name = "";

    const formnameNodes = personNode.getElementsByTagName("pms:formname");
    Array.from(formnameNodes).forEach(formnameNode => {
        const formnameIdentifier = formnameNode.getElementsByTagName("pms:instanceIdentifier")[0]?.getElementsByTagName("pms:textString")[0]?.textContent;

        if (formnameIdentifier === "FormName-Full-PRI") {
            full_name = formnameNode.getElementsByTagName("pms:formattedName")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        }
        if (formnameIdentifier === "FormName-Preferred-PRF") {
            preferred_name = formnameNode.getElementsByTagName("pms:formattedName")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        }
    });

    // Handle all parts of the full and preferred names
    let full_first = "", full_middle = "", full_last = "", full_given = "", full_family = "", full_surname = "", full_suffix = "", full_prefix = "";
    let preferred_first = "", preferred_middle = "", preferred_last = "", preferred_given = "", preferred_family = "", preferred_surname = "", preferred_suffix = "", preferred_prefix = "";

    const nameNodes = personNode.getElementsByTagName("pms:name");
    Array.from(nameNodes).forEach(nameNode => {
        const nameIdentifier = nameNode.getElementsByTagName("pms:instanceIdentifier")[0]?.getElementsByTagName("pms:textString")[0]?.textContent;
        const partNameNodes = nameNode.getElementsByTagName("pms:partName");

        Array.from(partNameNodes).forEach(partNameNode => {
            const partIdentifier = partNameNode.getElementsByTagName("pms:instanceIdentifier")[0]?.getElementsByTagName("pms:textString")[0]?.textContent;

            // Full name parts
            if (partIdentifier === "Full-PRI-First") full_first = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Full-PRI-Middle") full_middle = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Full-PRI-Last") full_last = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Full-PRI-Given") full_given = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Full-PRI-Family") full_family = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Full-PRI-Surname") full_surname = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Full-PRI-Suffix") full_suffix = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Full-PRI-Prefix") full_prefix = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";

            // Preferred name parts
            if (partIdentifier === "Preferred-PRF-First") preferred_first = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Preferred-PRF-Middle") preferred_middle = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Preferred-PRF-Last") preferred_last = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Preferred-PRF-Given") preferred_given = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Preferred-PRF-Family") preferred_family = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Preferred-PRF-Surname") preferred_surname = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Preferred-PRF-Suffix") preferred_suffix = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (partIdentifier === "Preferred-PRF-Prefix") preferred_prefix = partNameNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        });
    });

    // Handle contact info
    let email = "", telephone = "", telephone_home = "", telephone_cell = "", telephone_current = "", telephone_work = "";
    const contactInfoNodes = personNode.getElementsByTagName("pms:contactinfo");

    Array.from(contactInfoNodes).forEach(contactInfoNode => {
        const identifierText = contactInfoNode.getElementsByTagName("pms:instanceIdentifier")[0]?.getElementsByTagName("pms:textString")[0]?.textContent;

        if (identifierText === "EmailPrimary-BUEM") email = contactInfoNode.getElementsByTagName("pms:contactinfoValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        if (identifierText === "Telephone-BUAL") telephone = contactInfoNode.getElementsByTagName("pms:contactinfoValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        if (identifierText === "Telephone-HOME") telephone_home = contactInfoNode.getElementsByTagName("pms:contactinfoValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        if (identifierText === "Telephone-CELL") telephone_cell = contactInfoNode.getElementsByTagName("pms:contactinfoValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        if (identifierText === "Telephone-CRNT") telephone_current = contactInfoNode.getElementsByTagName("pms:contactinfoValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        if (identifierText === "Telephone-WORK") telephone_work = contactInfoNode.getElementsByTagName("pms:contactinfoValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
    });

    // Handle demographics
    let gender = "", birthplace = "", birthdate = "", marital_status = "";
    const demographicNodes = personNode.getElementsByTagName("pms:demographics");

    Array.from(demographicNodes).forEach(demographicNode => {
        gender = demographicNode.getElementsByTagName("pms:gender")[0]?.textContent || "";

        const demoInfoNodes = demographicNode.getElementsByTagName("pms:demographicInfo");
        Array.from(demoInfoNodes).forEach(demoInfoNode => {
            const demoIdentifierText = demoInfoNode.getElementsByTagName("pms:instanceIdentifier")[0]?.getElementsByTagName("pms:textString")[0]?.textContent;
            if (demoIdentifierText === "PlaceofBirth") birthplace = demoInfoNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
            if (demoIdentifierText === "MaritalStatus") marital_status = demoInfoNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        });

        const eventDateNodes = demographicNode.getElementsByTagName("pms:eventDate");
        Array.from(eventDateNodes).forEach(eventDateNode => {
            const eventIdentifierText = eventDateNode.getElementsByTagName("pms:instanceIdentifier")[0]?.getElementsByTagName("pms:textString")[0]?.textContent;
            if (eventIdentifierText === "Birth") birthdate = eventDateNode.getElementsByTagName("pms:instanceValue")[0]?.getElementsByTagName("pms:textString")[0]?.textContent || "";
        });
    });

    // Return the parsed data object
    return {
        buid,
        full_name,
        preferred_name,
        full_first,
        full_middle,
        full_last,
        full_given,
        full_family,
        full_surname,
        full_suffix,
        full_prefix,
        preferred_first,
        preferred_middle,
        preferred_last,
        preferred_given,
        preferred_family,
        preferred_surname,
        preferred_suffix,
        preferred_prefix,
        email,
        telephone,
        telephone_home,
        telephone_cell,
        telephone_current,
        telephone_work,
        birthplace,
        birthdate,
        gender,
        marital_status
    };
}

function parseCourseSectionNode(courseSectionNode) {
    // Get ID from sourcedGUID > sourcedId
    const sourceid = courseSectionNode.getElementsByTagName("cms:sourcedId")[0]?.textContent || "";

    let title = "";
    let parentofferingid = ""
    let status = "";
    let shortdescription = "";
    let longdescription = "";
    let category = "";
    let maxstudents = "";
    let numstudents = "";
    let session = "";
    let org = "";
    let begintime = "";
    let endtime = "";
    let location = "";
    let notes = "";
    let meeting = "";

    const courseSections = courseSectionNode.getElementsByTagName("cms:courseSection");

    Array.from(courseSections).forEach(courseSection => {
        // Title
        const titleElement = courseSection.getElementsByTagName("cms:title")[0];
        if (titleElement) {
            title = titleElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Status
        status = courseSection.getElementsByTagName("cms:status")[0]?.textContent || "";

        // Parent offering ID
        parentofferingid = courseSection.getElementsByTagName("cms:parentOfferingId")[0]?.textContent || "";

        // Short Description
        const shortDescElement = courseSection.getElementsByTagName("cms:shortDescription")[0];
        if (shortDescElement) {
            shortdescription = shortDescElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Long Description
        const longDescElement = courseSection.getElementsByTagName("cms:longDescription")[0];
        if (longDescElement) {
            longdescription = longDescElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Category
        const categoryElement = courseSection.getElementsByTagName("cms:category")[0];
        if (categoryElement) {
            category = categoryElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Max number of students
        maxstudents = courseSection.getElementsByTagName("cms:maxNumberofStudents")[0]?.textContent || "";

        // Number of students
        numstudents = courseSection.getElementsByTagName("cms:numberofStudents")[0]?.textContent || "";

        // Academic session
        const sessionElement = courseSection.getElementsByTagName("cms:academicSession")[0];
        if (sessionElement) {
            session = sessionElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Organization
        const orgElement = courseSection.getElementsByTagName("cms:org")[0];
        if (orgElement) {
            org = orgElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Time frame (begin and end time)
        const timeFrameElement = courseSection.getElementsByTagName("cms:timeFrame")[0];
        if (timeFrameElement) {
            begintime = timeFrameElement.getElementsByTagName("cms:begin")[0]?.textContent || "";
            endtime = timeFrameElement.getElementsByTagName("cms:end")[0]?.textContent || "";
        }

        // Location
        const locationElement = courseSection.getElementsByTagName("cms:location")[0];
        if (locationElement) {
            location = locationElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Notes
        const notesElement = courseSection.getElementsByTagName("cms:notes")[0];
        if (notesElement) {
            notes = notesElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }

        // Meeting
        const meetingElement = courseSection.getElementsByTagName("cms:meeting")[0];
        if (meetingElement) {
            meeting = meetingElement.getElementsByTagName("cms:textString")[0]?.textContent || "";
        }
    });

    // Return the parsed data object
    return {
        sourceid,
        title,
        parentofferingid,
        shortdescription,
        longdescription,
        status,
        category,
        numstudents,
        maxstudents,
        session,
        org,
        begintime,
        endtime,
        location,
        meeting,
        notes
    };
}

function parseMembershipNode(membershipNode) {
    // Get ID from sourcedGUID > sourcedId
    const sourceid = membershipNode.getElementsByTagName("mms:sourcedId")[0]?.textContent || "";

    let collectionsourceid = "";
    let membershipidtype = "";
    let buid = "";
    let roletype = "";
    let subrole = "";
    let timeframe = "";
    let status = "";

    // Get the membership node
    const memberships = membershipNode.getElementsByTagName("mms:membership");

    Array.from(memberships).forEach(membership => {
        // Collection Sourced ID
        collectionsourceid = membership.getElementsByTagName("mms:collectionSourcedId")[0]?.textContent || "";

        // Membership ID Type
        membershipidtype = membership.getElementsByTagName("mms:membershipIdType")[0]?.textContent || "";

        // Member details
        const member = membership.getElementsByTagName("mms:member")[0];
        if (member) {
            // Person Sourced ID
            buid = member.getElementsByTagName("mms:personSourcedId")[0]?.textContent || "";

            // Role details
            const role = member.getElementsByTagName("mms:role")[0];
            if (role) {
                // Role Type
                roletype = role.getElementsByTagName("mms:roleType")[0]?.textContent || "";

                // Sub Role
                subrole = role.getElementsByTagName("mms:subRole")[0]?.textContent || "";

                // Time Frame
                timeframe = role.getElementsByTagName("mms:timeFrame")[0]?.textContent || "";

                // Status
                status = role.getElementsByTagName("mms:status")[0]?.textContent || "";
            }
        }
    });

    // Return the parsed data object
    return {
        sourceid,
        collectionsourceid,
        membershipidtype,
        buid,
        roletype,
        subrole,
        timeframe,
        status
    };
}

function parseGroupNode(groupNode) {
    // Get ID from sourcedGUID > sourcedId
    const sourceid = groupNode.getElementsByTagName("gms:sourcedId")[0]?.textContent || "";

    let scheme = "";
    let typevalueid = "";
    let type = "";
    let level = "";
    let orgname = "";
    let orgid = "";
    let longdescription = "";
    let shortdescription = "";

    // Get the group node
    const groups = groupNode.getElementsByTagName("gms:group");

    Array.from(groups).forEach(group => {
        // Group Type
        const groupType = group.getElementsByTagName("gms:groupType")[0];
        if (groupType) {
            // Scheme
            scheme = groupType.getElementsByTagName("gms:scheme")[0]?.getElementsByTagName("gms:textString")[0]?.textContent || "";

            // Type Value
            const typevalue = groupType.getElementsByTagName("gms:typevalue")[0];
            if (typevalue) {
                // ID for type value
                typevalueid = typevalue.getElementsByTagName("gms:id")[0]?.textContent || "";

                // Type text
                type = typevalue.getElementsByTagName("gms:type")[0]?.getElementsByTagName("gms:textString")[0]?.textContent || "";

                // Level text
                level = typevalue.getElementsByTagName("gms:level")[0]?.getElementsByTagName("gms:textString")[0]?.textContent || "";
            }
        }

        // Organization details
        const org = group.getElementsByTagName("gms:org")[0];
        if (org) {
            // Organization Name
            orgname = org.getElementsByTagName("gms:orgName")[0]?.getElementsByTagName("gms:textString")[0]?.textContent || "";

            // Organization ID
            orgid = org.getElementsByTagName("gms:id")[0]?.textContent || "";
        }

        // Description
        const description = group.getElementsByTagName("gms:description")[0];
        if (description) {
            // Short Description
            shortdescription = description.getElementsByTagName("gms:shortDescription")[0]?.textContent || "";

            // Long Description
            longdescription = description.getElementsByTagName("gms:longDescription")[0]?.textContent || "";
        }
    });

    // Return the parsed data object
    return {
        sourceid,
        scheme,
        typevalueid,
        type,
        level,
        orgid,
        orgname,
        shortdescription,
        longdescription
    };
}

function escapeCSVValue(value) {
    // Check if the value is undefined or null
    if (value === undefined || value === null) return '';

    // Convert value to string and escape double quotes
    const escapedValue = String(value).replace(/"/g, '""');
    // Return value wrapped in double quotes if it contains commas or quotes
    return escapedValue.includes(',') || escapedValue.includes('"') ? `"${escapedValue}"` : escapedValue;
}

function extractCSVFromXML(xmlDoc, parseType) {
    let csvRow = '';

    // Helper function to build CSV row from object data
    function buildCSVRow(dataObj) {
        return Object.values(dataObj)
            .map(value => escapeCSVValue(value)) // Escape each value
            .join(",") + "\n";
    }

    if (parseType === 'PRSN') {
        const personNodes = xmlDoc.getElementsByTagName("pms:personRecord");
        Array.from(personNodes).forEach(personNode => {
            const personData = parsePersonNode(personNode);
            csvRow += buildCSVRow(personData);
        });
    }

    if (parseType === 'CSEC') {
        const courseSectionNodes = xmlDoc.getElementsByTagName("cms:courseSectionRecord");
        Array.from(courseSectionNodes).forEach(courseSectionNode => {
            const courseSectionData = parseCourseSectionNode(courseSectionNode);
            csvRow += buildCSVRow(courseSectionData);
        });
    }

    if (parseType === 'MEMB') {
        const membershipNodes = xmlDoc.getElementsByTagName("mms:membershipRecord");
        Array.from(membershipNodes).forEach(membershipNode => {
            const membershipData = parseMembershipNode(membershipNode);
            csvRow += buildCSVRow(membershipData);
        });
    }

    if (parseType === 'GRP') {
        const groupNodes = xmlDoc.getElementsByTagName("gms:groupRecord");
        Array.from(groupNodes).forEach(groupNode => {
            const groupData = parseGroupNode(groupNode);
            csvRow += buildCSVRow(groupData);
        });
    }

    return csvRow;
}

function updateProgressBar(loaded, total) {
    const percent = (loaded / total) * 100;
    const progressBar = document.getElementById("progressBar");
    progressBar.style.width = percent + '%';
}

function createDownloadLink(csvContent, parseType, totalLines) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Generate a timestamp in YYYYMMDD_HHmmss format
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHmmss
    const timestamp = `${date}_${time}`;

    // Create a dynamic file name using parseType and timestamp
    const fileName = `${parseType}_Parsed_${timestamp}.csv`;

    // Update the link with the CSV download URL and file name
    const linkElement = document.getElementById("downloadCSVLink");
    linkElement.setAttribute("href", url);
    linkElement.setAttribute("download", fileName);

    // Display the total number of records above the download link
    const totalRecordsElement = document.getElementById("totalRecords");
    totalRecordsElement.innerHTML = `Total Records: ${totalLines.toLocaleString()}`;
    totalRecordsElement.style.display = 'block';

    // Show the download link
    document.getElementById("downloadLink").style.display = 'block';
}

function displayParsedData(xmlDoc, parseType) {
    const tableBody = document.getElementById("outputTable").querySelector("tbody");
    tableBody.innerHTML = '';
    const contactBody = document.getElementById("contactTable").querySelector("tbody");
    contactBody.innerHTML = '';
    let url = "";

    if (parseType === 'PRSN') {
        const personNodes = xmlDoc.getElementsByTagName("pms:personRecord");

        Array.from(personNodes).forEach(personNode => {
            const personData = parsePersonNode(personNode);

            // Create MyBuStudent link using buid
            url = personData.buid ? 'https://mybustudent.bu.edu/psp/BUPRD/EMPLOYEE/SA/s/WEBLIB_HCX_GN_S.H_DASHBOARD.FieldFormula.IScript_Main?pslnkid=HPT_CX_DASHBOARD_STAFF&emplid=' + personData.buid + '&lookupType=S&institution=BU001' : "#";

            document.getElementById("contactTable").style.display = 'table';
            var nameHeader = document.getElementById('nameHeader');
            nameHeader.innerHTML = `${personData.preferred_name}`;

            // Use personData for table display
            contactBody.innerHTML = `
				<tr><td width="50%">BUID</td><td width="50%">${personData.buid}</td></tr>
				<tr><td width="50%">MyBU Student</td><td width="50%">[<a href="${url}" target="_blank">Impersonate User</a>]</td></tr>
			`;

            document.getElementById("break").style.display = 'block';

            tableBody.innerHTML = `
				<tr><td>Form Name [Full]</td><td>${personData.full_name}</td></tr>
				<tr><td>Form Name [Preferred]</td><td>${personData.preferred_name}</td></tr>
				<tr><td>Full Name [First]</td><td>${personData.full_first}</td></tr>
				<tr><td>Full Name [Middle]</td><td>${personData.full_middle}</td></tr>
				<tr><td>Full Name [Last]</td><td>${personData.full_last}</td></tr>
				<tr><td>Full Name [Given]</td><td>${personData.full_given}</td></tr>
				<tr><td>Full Name [Family]</td><td>${personData.full_family}</td></tr>
				<tr><td>Full Name [Surname]</td><td>${personData.full_surname}</td></tr>
				<tr><td>Full Name [Suffix]</td><td>${personData.full_suffix}</td></tr>
				<tr><td>Full Name [Prefix]</td><td>${personData.full_prefix}</td></tr>
				<tr><td>Preferred Name [First]</td><td>${personData.preferred_first}</td></tr>
				<tr><td>Preferred Name [Middle]</td><td>${personData.preferred_middle}</td></tr>
				<tr><td>Preferred Name [Last]</td><td>${personData.preferred_last}</td></tr>
				<tr><td>Preferred Name [Given]</td><td>${personData.preferred_given}</td></tr>
				<tr><td>Preferred Name [Family]</td><td>${personData.preferred_family}</td></tr>
				<tr><td>Preferred Name [Surname]</td><td>${personData.preferred_surname}</td></tr>
				<tr><td>Preferred Name [Suffix]</td><td>${personData.preferred_suffix}</td></tr>
				<tr><td>Preferred Name [Prefix]</td><td>${personData.preferred_prefix}</td></tr>
				<tr><td>Email [Primary]</td><td>${personData.email}</td></tr>
				<tr><td>Telephone</td><td>${personData.telephone}</td></tr>
				<tr><td>Telephone [Home]</td><td>${personData.telephone_home}</td></tr>
				<tr><td>Telephone [Cell]</td><td>${personData.telephone_cell}</td></tr>
				<tr><td>Telephone [Current]</td><td>${personData.telephone_current}</td></tr>
				<tr><td>Telephone [Work]</td><td>${personData.telephone_work}</td></tr>
				<tr><td>Place of Birth</td><td>${personData.birthplace}</td></tr>
				<tr><td>Date of Birth</td><td>${personData.birthdate}</td></tr>
				<tr><td>Gender</td><td>${personData.gender}</td></tr>
				<tr><td>Marital Status</td><td>${personData.marital_status}</td></tr>
			`;
        });
    }

    if (parseType === 'CSEC') {
        const courseSectionNodes = xmlDoc.getElementsByTagName("cms:courseSectionRecord");
        Array.from(courseSectionNodes).forEach(courseSectionNode => {
            const courseSectionData = parseCourseSectionNode(courseSectionNode);
            tableBody.innerHTML = `
				<tr><td>Source ID</td><td>${courseSectionData.sourceid}</td></tr>
				<tr><td>Title</td><td>${courseSectionData.title}</td></tr>
				<tr><td>Parent Offering ID</td><td>${courseSectionData.parentofferingid}</td></tr>
				<tr><td>Short Description</td><td>${courseSectionData.shortdescription}</td></tr>
				<tr><td>Long Description</td><td>${courseSectionData.longdescription}</td></tr>
				<tr><td>Status</td><td>${courseSectionData.status}</td></tr>
				<tr><td>Category</td><td>${courseSectionData.category}</td></tr>
				<tr><td>Number of Students</td><td>${courseSectionData.numstudents}</td></tr>
				<tr><td>Max Number of Students</td><td>${courseSectionData.maxstudents}</td></tr>
				<tr><td>Academic Session</td><td>${courseSectionData.session}</td></tr>
				<tr><td>Org</td><td>${courseSectionData.org}</td></tr>
				<tr><td>Begin</td><td>${courseSectionData.begintime}</td></tr>
				<tr><td>End</td><td>${courseSectionData.endtime}</td></tr>
				<tr><td>Location</td><td>${courseSectionData.location}</td></tr>
				<tr><td>Meeting</td><td>${courseSectionData.meeting}</td></tr>
				<tr><td>Notes</td><td>${courseSectionData.notes}</td></tr>
			`;
        });
    }

    if (parseType === 'MEMB') {
        const membershipNodes = xmlDoc.getElementsByTagName("mms:membershipRecord");

        Array.from(membershipNodes).forEach(membershipNode => {
            const membershipData = parseMembershipNode(membershipNode);
            // Create MyBuStudent link using buid
            url = membershipData.buid ? 'https://mybustudent.bu.edu/psp/BUPRD/EMPLOYEE/SA/s/WEBLIB_HCX_GN_S.H_DASHBOARD.FieldFormula.IScript_Main?pslnkid=HPT_CX_DASHBOARD_STAFF&emplid=' + membershipData.buid + '&lookupType=S&institution=BU001' : "#";

            tableBody.innerHTML = `
				<tr><td>Source ID</td><td>${membershipData.sourceid}</td></tr>
				<tr><td>Collection Source ID</td><td>${membershipData.collectionsourceid}</td></tr>
				<tr><td>Membership ID Type</td><td>${membershipData.membershipidtype}</td></tr>
				<tr><td>BUID</td><td>${membershipData.buid}</td></tr>
				<tr><td>MyBU Student</td><td>[<a href="${url}" target="_blank">Impersonate User</a>]</td></tr>
				<tr><td>Role Type</td><td>${membershipData.roletype}</td></tr>
				<tr><td>Sub Role</td><td>${membershipData.subrole}</td></tr>
				<tr><td>Time Frame</td><td>${membershipData.timeframe}</td></tr>
				<tr><td>Status</td><td>${membershipData.status}</td></tr>
			`;
        });
    }

    if (parseType === 'GRP') {
        const groupNodes = xmlDoc.getElementsByTagName("gms:groupRecord");

        Array.from(groupNodes).forEach(groupNode => {
            const groupData = parseGroupNode(groupNode);

            tableBody.innerHTML = `
				<tr><td>Source ID</td><td>${groupData.sourceid}</td></tr>
				<tr><td>Scheme</td><td>${groupData.scheme}</td></tr>
				<tr><td>Type Value ID</td><td>${groupData.typevalueid}</td></tr>
				<tr><td>Type</td><td>${groupData.type}</td></tr>
				<tr><td>Level</td><td>${groupData.level}</td></tr>
				<tr><td>Org ID</td><td>${groupData.orgid}</td></tr>
				<tr><td>Org Name</td><td>${groupData.orgname}</td></tr>
				<tr><td>Short Description</td><td>${groupData.shortdescription}</td></tr>
				<tr><td>Long Description</td><td>${groupData.longdescription}</td></tr>
			`;
        });
    }
}

// Trigger file reading and parsing when a file is selected
document.getElementById('fileInput').addEventListener('change', parse);

// Add event listener for automatic parsing after paste/change
document.getElementById("xmlInput").addEventListener("input", parse);