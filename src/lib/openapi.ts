import { amenityKeys, cities } from "./hotels-shared";

/** OpenAPI 3.0 document for ChatGPT custom GPT actions and Grok / other assistants that import an OpenAPI spec. */
export function openApiDocument(origin: string) {
  const cityIds = cities.map((c) => c.id);
  return {
    openapi: "3.0.3",
    info: {
      title: "Yado hotel booking",
      version: "1.0.0",
      description: [
        "You are booking a hotel, or creating a hotel listing, for the person you are talking to.",
        "Guest example: book a room on these dates, for this budget, near this place. Call searchHotels with checkIn, checkOut, near, and maxPricePerNight or maxTotal, then createBooking. Never ask for the card number, expiry, or CVC. If the response has paymentUrl, send the guest there. If it has confirmationUrl, the stay is confirmed.",
        "Hotel example: make a listing with these photos, for this nightly price, at this location. Send Authorization: Bearer and the hotel's yado_ key, then POST name, city, address, pricePerNight, and photos. English is fine.",
        "Money is yen. Dates are YYYY-MM-DD. Only live hotels can be booked. The createListing response says whether this listing is live. On a test server without Stripe a new listing goes live at once; on production it stays pending until an admin approves it and the annual fee is paid.",
        "Send a unique Idempotency-Key header on POST and PUT so a retry does not create a second booking or listing.",
      ].join(" "),
    },
    servers: [{ url: origin }],
    tags: [
      { name: "Search", description: "Find live hotels and rooms." },
      { name: "Bookings", description: "Create and look up guest bookings." },
      { name: "Listings", description: "Hotel partners create and update listings." },
      { name: "Auth", description: "API keys for assistants." },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Partner or guest API key from POST /api/v1/auth/token or the Yado dashboard. Example: yado_…",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: { code: { type: "string" }, message: { type: "string" } },
              required: ["code", "message"],
            },
          },
        },
        RoomOffer: {
          type: "object",
          properties: {
            id: { type: "string", description: "Pass this as roomId when booking." },
            name: { type: "object", properties: { en: { type: "string" }, ja: { type: "string" } } },
            sleeps: { type: "integer" },
            pricePerNightJpy: { type: "integer" },
            available: { type: "integer", description: "Rooms left for the requested stay. Present when dates were sent." },
            totalJpy: { type: "integer", description: "pricePerNightJpy × nights. Present when dates were sent." },
            breakfast: { type: "boolean" },
            refundable: { type: "boolean" },
          },
        },
        ListingRoom: {
          type: "object",
          required: ["nameJa", "sleeps", "pricePerNight", "quantity"],
          properties: {
            id: { type: "string", description: "Existing room id when updating. Omit to add a room." },
            nameJa: { type: "string" },
            descriptionJa: { type: "string" },
            nameEn: { type: "string" },
            descriptionEn: { type: "string" },
            sleeps: { type: "integer", minimum: 1, maximum: 12 },
            sizeSqm: { type: "integer" },
            pricePerNight: { type: "integer", description: "JPY including tax. Minimum 500." },
            quantity: { type: "integer" },
            breakfast: { type: "boolean" },
            refundable: { type: "boolean" },
          },
        },
        Listing: {
          type: "object",
          required: ["name", "city", "address", "pricePerNight"],
          description: "Send the brief the hotel told you: name, city, address, pricePerNight (yen), photos, and a Google Maps link (mapsUrl). English is fine. Phone, licence, and Japanese are optional. A rooms array is optional; one room is created from pricePerNight.",
          properties: {
            name: { type: "string", description: "Property name, in whatever language the hotel used." },
            nameJa: { type: "string", description: "Japanese name, if you have it. Otherwise send name." },
            nameEn: { type: "string" },
            roomName: { type: "string", description: "Name of the room, when you are not sending a rooms array." },
            pricePerNight: { type: "integer", description: "Yen per night. Used when rooms is omitted." },
            sleeps: { type: "integer", description: "How many guests the room sleeps. Default 2." },
            photos: { type: "array", items: { type: "string" }, description: "https photo URLs. Same as images." },
            type: { type: "string", enum: ["hotel", "ryokan", "business", "hostel"], description: "Default hotel." },
            city: { type: "string", description: "City name or id, for example Kyoto or kyoto.", enum: cityIds },
            address: { type: "string" },
            mapsUrl: { type: "string", description: "Google Maps link to the property (maps.app.goo.gl or maps.google.com). The pin is read from it." },
            phone: { type: "string" },
            licenseNumber: { type: "string", description: "旅館業許可番号, if the hotel gave it to you." },
            stationJa: { type: "string" },
            stationEn: { type: "string" },
            areaJa: { type: "string" },
            areaEn: { type: "string" },
            descriptionJa: { type: "string" },
            descriptionEn: { type: "string" },
            accessJa: { type: "string" },
            accessEn: { type: "string" },
            checkInTime: { type: "string", example: "15:00" },
            checkOutTime: { type: "string", example: "11:00" },
            amenities: { type: "array", items: { type: "string", enum: [...amenityKeys] } },
            images: { type: "array", items: { type: "string" }, description: "Photo URLs, https only. Use the links the hotel gave you." },
            latitude: { type: "number" },
            longitude: { type: "number" },
            rooms: { type: "array", items: { $ref: "#/components/schemas/ListingRoom" } },
            locale: { type: "string", enum: ["ja", "en"], description: "Language of the confirmation email. Default ja." },
            retranslate: { type: "boolean", description: "On update, translate Japanese into English again." },
          },
        },
      },
    },
    paths: {
      "/api/v1/cities": {
        get: {
          operationId: "listCities",
          tags: ["Search"],
          summary: "City ids you can pass to search and to a listing.",
          responses: { "200": { description: "Cities" } },
        },
      },
      "/api/v1/hotels": {
        get: {
          operationId: "searchHotels",
          tags: ["Search"],
          summary: "Search live hotels. Call this before booking.",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "City, station, area, or hotel name." },
            { name: "near", in: "query", schema: { type: "string" }, description: "Same as q. A station, neighbourhood, or city name, matched against the listing's name, area, station, address, and city. For 'cheapest near X' send near=X and sort=priceLow. If nothing matches, search the city instead." },
            { name: "city", in: "query", schema: { type: "string", enum: cityIds } },
            { name: "checkIn", in: "query", schema: { type: "string", format: "date" }, description: "YYYY-MM-DD. Send with checkOut to see which rooms are free and the stay total." },
            { name: "checkOut", in: "query", schema: { type: "string", format: "date" } },
            { name: "minPricePerNight", in: "query", schema: { type: "integer" }, description: "Lowest nightly price in yen, tax included." },
            { name: "maxPricePerNight", in: "query", schema: { type: "integer" }, description: "Highest nightly price in yen, tax included. Use when they name a per-night budget." },
            { name: "maxTotal", in: "query", schema: { type: "integer" }, description: "Highest price for the whole stay in yen. Requires checkIn and checkOut. Use when they say 'for 30000 yen' for those dates." },
            { name: "guests", in: "query", schema: { type: "integer", minimum: 1, maximum: 8 } },
            { name: "sort", in: "query", schema: { type: "string", enum: ["recommended", "priceLow", "priceHigh", "rating", "size", "sizeSmall"] } },
          ],
          responses: { "200": { description: "Matching hotels and bookable rooms." }, "400": { description: "Invalid query" } },
        },
      },
      "/api/v1/hotels/{id}": {
        get: {
          operationId: "getHotel",
          tags: ["Search"],
          summary: "One live hotel, including room ids to book.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Hotel id (slug) from search." },
            { name: "checkIn", in: "query", schema: { type: "string", format: "date" } },
            { name: "checkOut", in: "query", schema: { type: "string", format: "date" } },
            { name: "guests", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "Hotel" }, "404": { description: "Not found or not live" } },
        },
      },
      "/api/v1/bookings": {
        get: {
          operationId: "listBookings",
          tags: ["Bookings"],
          summary: "Bookings for the API key's guest, or for the partner's hotels.",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Bookings" }, "401": { description: "API key required" } },
        },
        post: {
          operationId: "createBooking",
          tags: ["Bookings"],
          summary: "Hold a room and return a Stripe Checkout link. Confirm hotel, room, dates, and guest details first.",
          description: "No guest API key required. Never collect a card number, expiry, or CVC. When the response includes paymentUrl, send the guest there to pay on Stripe. When it includes confirmationUrl and cardEntry is demo, the stay is already confirmed on this demo server.",
          parameters: [
            { name: "Idempotency-Key", in: "header", schema: { type: "string" }, description: "Unique per booking attempt. Reuse it if you retry." },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["hotelId", "roomId", "checkIn", "checkOut", "guests", "firstName", "lastName", "email", "phone"],
                  properties: {
                    hotelId: { type: "string", description: "Hotel id from search." },
                    roomId: { type: "string", description: "Room id from search." },
                    checkIn: { type: "string", example: "2026-11-01" },
                    checkOut: { type: "string", example: "2026-11-03" },
                    guests: { type: "integer" },
                    firstName: { type: "string" },
                    lastName: { type: "string" },
                    email: { type: "string", format: "email" },
                    phone: { type: "string" },
                    requests: { type: "string" },
                    locale: { type: "string", enum: ["en", "ja"] },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Booking created. Includes ref, status, paymentUrl, confirmationUrl, and viewToken." },
            "400": { description: "Invalid input" },
            "409": { description: "Sold out" },
          },
        },
      },
      "/api/v1/bookings/{ref}": {
        get: {
          operationId: "getBooking",
          tags: ["Bookings"],
          summary: "Booking status. Pass the view token from createBooking, or the guest/partner API key.",
          parameters: [
            { name: "ref", in: "path", required: true, schema: { type: "string" } },
            { name: "token", in: "query", schema: { type: "string" }, description: "viewToken returned when the booking was created." },
          ],
          responses: { "200": { description: "Booking" }, "404": { description: "Not found" } },
        },
      },
      "/api/v1/listings": {
        get: {
          operationId: "listListings",
          tags: ["Listings"],
          summary: "The partner's listings, including ones that are not live yet.",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Listings" }, "401": { description: "Partner API key required" } },
        },
        post: {
          operationId: "createListing",
          tags: ["Listings"],
          summary: "Create a hotel listing. The chatbot must send the partner API key.",
          description: "Requires Authorization: Bearer and the key the hotel pasted into the chatbot. Body: name, city, address, pricePerNight in yen, and photos (https). English is fine. Do not ask for a card number.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Listing" } } },
          },
          responses: { "201": { description: "Listing created. The response says whether guests can book it yet." }, "400": { description: "Invalid listing" }, "409": { description: "Email already registered" } },
        },
      },
      "/api/v1/listings/{id}": {
        get: {
          operationId: "getListing",
          tags: ["Listings"],
          summary: "One listing owned by the partner, by id or slug.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Listing" }, "404": { description: "Not found" } },
        },
        put: {
          operationId: "updateListing",
          tags: ["Listings"],
          summary: "Replace a listing's public copy. Send the full listing, including room ids you want to keep.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Listing" } } },
          },
          responses: { "200": { description: "Updated" }, "404": { description: "Not found" } },
        },
      },
      "/api/v1/auth/token": {
        post: {
          operationId: "createApiKey",
          tags: ["Auth"],
          summary: "Exchange a partner email and password for an API key.",
          description: "The email must already be verified. The key is shown once. Guests do not have passwords; they can book without a key, or create a key while signed in on the website.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                    label: { type: "string", description: "Name for this key, such as the assistant you will paste it into." },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "API key" }, "401": { description: "Wrong email or password" }, "403": { description: "Email not verified, or this role cannot use a key" } },
        },
        get: {
          operationId: "listApiKeys",
          tags: ["Auth"],
          summary: "List this account's API keys. Secrets are not included.",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Keys" } },
        },
        delete: {
          operationId: "revokeCurrentApiKey",
          tags: ["Auth"],
          summary: "Revoke the API key used in this request.",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Revoked" } },
        },
      },
    },
  };
}
