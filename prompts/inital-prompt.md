Act as an expert Full-Stack Software Architect specializing in Cloudflare Serverless runtimes. I need you to construct a single-page web app implementing the core features detailed in the feature list provided. Write clean, modular, and performant code. Ensure all layout aesthetics are built using utility-first Tailwind CSS classes on a slate-900 background. Focus heavily on avoiding external dependencies for the backend—all API paths under `/functions/api/` must handle data via native web stream standards.



# 📋 Prompt Feature List: All-in-One Network Intelligence Hub

> **System Prompt Context for AI:** Implement the following features within a single-page responsive dashboard layout. All dynamic backend calculations must be routed using native Fetch Request/Response patterns via Cloudflare Pages Functions.

## 1. Advanced IP & ASN Discovery Module

* **Frontend UI Requirement:**
* Display a modern card showing the user's public internet address.
* Show an "IPv4/IPv6 Dual Stack" status badge.
* Display the Internet Service Provider (ISP) and the official Autonomous System Number (ASN) in a clean monospace font block.


* **Edge Worker Endpoint (`/api/ip`):**
* Intercept the request and parse Cloudflare’s extended transport metrics.


* Extract: Client IP address, ASN integer code, and Registered AS Organization string.



	
* **Technical Variables Needed:** `CF-Connecting-IP`, `request.cf.asn`, `request.cf.asOrganization`.



## 2. High-Precision Geolocation Map Module

* **Frontend UI Requirement:**
* Embed an open-source, lightweight **Leaflet.js** map container styled with a custom dark-mode tile layout (e.g., CartoDB Dark Matter).


* Drop a vibrant indicator pin/circle over the latitude and longitude coordinates provided by the backend api.


* Render text block showing: `City, Region, Country, Postal Code`.




* **Edge Worker Integration:**
* Read regional routing metadata straight from the edge context object without calling heavy external geo-IP database APIs.




* **Technical Variables Needed:** `request.cf.city`, `request.cf.region`, `request.cf.country`, `request.cf.latitude`, `request.cf.longitude`.



## 3. Real-Time Network Speed Test Engine

* **Frontend UI Requirement:**
* Create a sweeping digital/canvas gauge or a live visual progress indicator that displays changing performance speeds in real time.
* Include metrics boxes for **Ping**, **Jitter**, **Download Speed**, and **Upload Speed**.




* **Phase A: Ping & Jitter Calculation:**
* Run a rapid loop of 6 successive `HEAD` requests to `/api/ping`.


* Calculate raw round-trip latency in milliseconds.


* Compute *Jitter* by calculating the mean absolute variation between sequential ping values.




* **Phase B: Download Bandwidth Throughput:**
* Fetch a fixed, high-entropy 5MB binary dummy block (`/assets/chunks/5mb.bin`) from the server cache using a randomized cache-busting string parameter.


* Measure timestamps immediately before and after stream resolution to derive raw Megabits per second ($Mbps$).




* **Phase C: Stream Upload Sink Throughput:**
* Generate a highly scrambled, uncompressible `Uint8Array` in the browser memory (to prevent middlebox compression spoofing).


* Stream this data over an HTTP `POST` request payload to `/api/upload`.


* The backend must process chunks on the fly via a `ReadableStream` reader, monitoring time-to-completion before instantly dropping data out of memory.





## 4. Edge-Accelerated DNS Resolver Tool

* **Frontend UI Requirement:**
* Provide an input text field where users can type any domain name (e.g., `google.com`).
* Include a dropdown selector to choose standard DNS record types: `A`, `AAAA`, `MX`, `TXT`, `CNAME`.


* Display the returned resolution mapping strings in a scannable table list.


* **Edge Worker Endpoint (`/api/dns`):**
* Sanitize the query input string to block parameter injection paths.


* Use downstream edge fetch patterns to interact directly with secure DNS-over-HTTPS (DoH) parameters (such as Cloudflare’s `1.1.1.1/dns-query`) and return standard JSON outputs.





## 5. Live Services Reachability Status Matrix

* **Frontend UI Requirement:**
* Create a modern visual status grid tracking popular digital platforms (e.g., Cloudflare, Google, AWS, GitHub, YouTube).
* Render a blinking status indicator next to each entry: 🟢 **Reachable** (Fast response), 🟡 **Degraded** (High latency), or 🔴 **Unreachable** (Timeout/Error).


* **Client Driver Mechanism:**
* Execute concurrent, non-blocking asynchronous requests to the public edge destinations or target checking paths of those infrastructure points, returning real-time indicators to confirm wide-area web access health.


