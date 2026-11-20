package com.repairloop.core.server;

import com.repairloop.core.engine.RepairDecisionEngine;
import com.repairloop.core.model.DecisionResult;
import com.repairloop.core.model.ProductInfo;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lightweight standalone HTTP server built with JDK 21's com.sun.net.httpserver.HttpServer.
 * Requires zero external frameworks (no Spring Boot).
 * Exposes the RepairDecisionEngine over REST-style JSON endpoints on port 8080.
 */
public class RepairLoopHttpServer {

    private static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : DEFAULT_PORT;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        RepairDecisionEngine engine = new RepairDecisionEngine();

        server.createContext("/api/health", exchange -> {
            addCorsHeaders(exchange.getResponseHeaders());
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            sendJson(exchange, 200, "{\"status\":\"ok\",\"service\":\"RepairLoopCore-Java21\"}");
        });

        server.createContext("/api/decision/evaluate", exchange -> {
            addCorsHeaders(exchange.getResponseHeaders());
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJson(exchange, 405, "{\"error\":\"Method not allowed. Use POST.\"}");
                return;
            }

            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            try {
                double originalPrice = extractDouble(body, "originalPrice", 1000);
                double productAgeYears = extractDouble(body, "productAgeYears", 3);
                double repairCost = extractDouble(body, "repairCost", 200);
                double replacementCost = extractDouble(body, "replacementCost", 1000);
                int additionalLifespanMonths = (int) extractDouble(body, "additionalLifespanMonths", 24);
                int previousRepairCount = (int) extractDouble(body, "previousRepairCount", 0);
                double previousRepairCost = extractDouble(body, "previousRepairCost", 0);
                boolean recurringFault = extractBoolean(body, "recurringFault", false);

                ProductInfo info = new ProductInfo(
                        "Evaluated Product", "Electronics", "Generic", "Model-X",
                        productAgeYears, originalPrice, replacementCost,
                        previousRepairCount, previousRepairCost, recurringFault
                );

                DecisionResult result = engine.evaluate(info, repairCost, additionalLifespanMonths);
                sendJson(exchange, 200, result.toJson());
            } catch (Exception ex) {
                sendJson(exchange, 400, "{\"error\":\"" + ex.getMessage().replace("\"", "'") + "\"}");
            }
        });

        server.setExecutor(null);
        server.start();
        System.out.println("RepairLoopCore Java HTTP server listening on http://localhost:" + port);
        System.out.println("Endpoints:");
        System.out.println("  GET  http://localhost:" + port + "/api/health");
        System.out.println("  POST http://localhost:" + port + "/api/decision/evaluate");
    }

    private static void addCorsHeaders(Headers headers) {
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        headers.set("Content-Type", "application/json; charset=UTF-8");
    }

    private static void sendJson(HttpExchange exchange, int statusCode, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static double extractDouble(String json, String key, double fallback) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*([-0-9.]+)");
        Matcher m = p.matcher(json);
        return m.find() ? Double.parseDouble(m.group(1)) : fallback;
    }

    private static boolean extractBoolean(String json, String key, boolean fallback) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(true|false)");
        Matcher m = p.matcher(json);
        return m.find() ? Boolean.parseBoolean(m.group(1)) : fallback;
    }
}
