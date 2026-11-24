package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.HfModelMeta;
import com.coderarmy.ragsupport.service.HfModelService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/models")
@CrossOrigin(origins = "*")
public class HfModelController {

    private final HfModelService hfModelService;

    public HfModelController(HfModelService hfModelService) {
        this.hfModelService = hfModelService;
    }

    /**
     * GET /api/models
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getModels(
            @RequestParam(value = "search", required = false, defaultValue = "") String search,
            @RequestParam(value = "task", required = false, defaultValue = "all") String task,
            @RequestParam(value = "provider", required = false, defaultValue = "all") String provider,
            @RequestParam(value = "hostingType", required = false, defaultValue = "all") String hostingType,
            @RequestParam(value = "sort", required = false, defaultValue = "popular") String sort,
            @RequestParam(value = "page", required = false, defaultValue = "1") int page,
            @RequestParam(value = "limit", required = false, defaultValue = "24") int limit,
            @RequestParam(value = "refresh", required = false, defaultValue = "false") boolean refresh
    ) {
        Map<String, Object> result = hfModelService.filterModels(
                search, task, provider, hostingType, sort, page, limit, refresh
        );
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/models/refresh
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refreshModels() {
        var list = hfModelService.getAllModels(true);
        return ResponseEntity.ok(Map.of(
                "message", "Model cache refreshed successfully",
                "count", list.size()
        ));
    }

    /**
     * GET /api/models/**
     */
    @GetMapping("/**")
    public ResponseEntity<?> getModelById(HttpServletRequest request) {
        String path = request.getRequestURI();
        String prefix = "/api/models/";
        if (!path.startsWith(prefix)) {
            return ResponseEntity.notFound().build();
        }
        String id = path.substring(prefix.length());
        HfModelMeta model = hfModelService.getModelById(id);
        if (model == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(model);
    }
}
