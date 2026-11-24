

export const getHeaders = (isFormData = false) => {
    let headers = {};
    
    // 1. ADMIN MODE: Hardcoded System context for the Admin UI
    if (window.location.pathname.includes('admin')) {
        headers = {
            'x-tenant-id': 'TENANT-ACME',
            'x-user-id': 'USER-ALICE',
            'x-execution-mode': 'SYSTEM'
        };
    } else {
        // 2. USER MODE: Read from memory
        headers = {
            'x-tenant-id': localStorage.getItem('dev_tenant') || 'TENANT-ACME',
            'x-user-id': localStorage.getItem('dev_user') || 'USER-ALICE',
            'x-execution-mode': 'USER'
        };
    }

    // IMPORTANT: Only set application/json if we are NOT sending FormData
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
};

/**
 * ARCHITECTURALLY SUPERIOR: Core API Client (Interceptor Pattern)
 * Centralizes header injection, error handling, JSON parsing, and cache-busting.
 */
// const apiClient = async (endpoint, options = {}) => {
//     const config = {
//         ...options,
//         headers: getHeaders()
//     };

//     // Automatically bust the cache for all GET requests to prevent SPA State Traps
//     if (!config.method || config.method.toUpperCase() === 'GET') {
//         config.cache = 'no-store';
//     }

//     const response = await fetch(endpoint, config);

//     // Gracefully handle empty responses (204 No Content)
//     if (response.status === 204) return null;

//     // Safely attempt to parse JSON
//     let data;
//     try { data = await response.json(); } catch (e) { data = null; }

//     // Centralized Error Extraction
//     if (!response.ok) {
//         const errorMessage = (data && data.detail) ? data.detail : `API Error: ${response.statusText}`;
//         throw new Error(errorMessage);
//     }

//     return data;
// };

// const apiClient = async (endpoint, options = {}) => {
//     const config = {
//         ...options,
//         headers: getHeaders()
//     };

//     if (!config.method || config.method.toUpperCase() === 'GET') {
//         config.cache = 'no-store';
//     }

//     const response = await fetch(endpoint, config);

//     if (response.status === 204) return null;

//     let data;
//     try { data = await response.json(); } catch (e) { data = null; }

//     // Centralized Error Extraction
//     if (!response.ok) {
//         // Extracts the FastAPI "detail" string or falls back to status text
//         const errorMessage = (data && data.detail) ? data.detail : `API Error: ${response.statusText}`;
        
//         // 🚨 NEW: Trigger the global UI notification directly from the API layer
//         if (typeof window !== 'undefined' && window.showToast) {
//             window.showToast(errorMessage, 'error');
//         }

//         // Still throw the error so the calling component knows the request failed
//         throw new Error(errorMessage);
//     }

//     return data;
// };

const apiClient = async (endpoint, options = {}) => {
    const config = {
        ...options,
        headers: getHeaders(options.body instanceof FormData)
    };

    if (!config.method || config.method.toUpperCase() === 'GET') {
        config.cache = 'no-store';
    }

    const response = await fetch(endpoint, config);

    if (response.status === 204) return null;

    let data;
    try { data = await response.json(); } catch (e) { data = null; }

    // Catch logical transaction failures (Validation Rules / Flows)
    if (data && Array.isArray(data.results)) {
        const failedResult = data.results.find(res => res.success === false);
        if (failedResult && Array.isArray(failedResult.errors) && failedResult.errors.length > 0) {
            const validationError = failedResult.errors[0];
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast(validationError, 'error');
            }
            throw new Error(validationError); 
        }
    }

    // Catch standard HTTP errors (400, 403, 500)
    if (!response.ok) {
        let errorMessage = `API Error: ${response.statusText}`;
        
        if (data) {
            if (data.detail) {
                errorMessage = data.detail;
            } else if (Array.isArray(data.results) && data.results[0]?.errors) {
                errorMessage = data.results[0].errors[0];
            }
        }
        
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast(errorMessage, 'error');
        }

        throw new Error(errorMessage);
    }

    return data;
};

// ===========================================
// METADATA & SCHEMA APIs
// ===========================================
export const fetchBlueprint = (objectName) => 
    apiClient(`/api/metadata/schema/${objectName}`);

export const fetchUISchema = async (objectName, view = 'list') => {
    // UI schema returns raw text, so we handle it slightly differently than standard JSON
    const response = await fetch(`/api/metadata/schema/${objectName}/ui-schema?view=${view}`, {
        headers: getHeaders(), cache: 'no-store'
    });
    if (!response.ok) throw new Error("Failed to load layout schema");
    return JSON.parse(await response.text());
};

export const fetchObjectsList = () => 
    apiClient('/api/metadata/objects');

export const createSystemObject = (payload) => 
    apiClient('/api/metadata/objects', { method: 'POST', body: JSON.stringify(payload) });

export const createObjectField = (objectName, payload) => 
    apiClient(`/api/metadata/schema/${objectName}/field`, { method: 'POST', body: JSON.stringify(payload) });

export const updateObjectField = (objectName, fieldName, payload) => 
    apiClient(`/api/metadata/schema/${objectName}/field/${fieldName}`, { method: 'PUT', body: JSON.stringify(payload) });

export const createValidationRuleAPI = (objectName, payload) => 
    apiClient(`/api/metadata/schema/${objectName}/validation-rule`, { method: 'POST', body: JSON.stringify(payload) });

export const updateValidationRuleAPI = (objectName, ruleId, payload) => 
    apiClient(`/api/metadata/schema/${objectName}/validation-rule/${ruleId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
export const updateObjectView = (objectName, payload) =>
    apiClient(`/api/metadata/schema/${objectName}/view`, { method: 'PUT', body: JSON.stringify(payload) });

// ===========================================
// QUERY & TRANSACTION APIs
// ===========================================

export const fetchSearch = (query) => 
    apiClient(`/api/search/?q=${encodeURIComponent(query)}`);

export const fetchRecordData = (objectName, fields, recordId) => 
    apiClient('/api/query', {
        method: 'POST',
        body: JSON.stringify({ object_name: objectName, fields, filters: [{ field: 'Id', operator: '=', value: recordId }] })
    });

export const fetchQuery = async (objectName, fields, filters = []) => {
    const res = await apiClient('/api/query', {
        method: 'POST', body: JSON.stringify({ object_name: objectName, fields, filters })
    });
    return res.data || []; // Extract data array wrapper
};

export const executeAction = (objectName, payload) => 
    apiClient(`/api/action/${objectName}`, {
        method: 'POST',
        body: JSON.stringify(Array.isArray(payload) ? payload : [payload])
    });

export const fetchReferenceLookup = (sourceObject, fieldName, query) => 
    apiClient(`/api/query/lookup/${sourceObject}/${fieldName}?q=${encodeURIComponent(query)}`);
// ===========================================
// SECURITY & DEPLOYMENT APIs
// ===========================================

export const fetchProfile = (profileId) =>
    apiClient(`/api/security/profiles/${profileId}`);

export const saveObjectPermissions = (payload) =>
    apiClient('/api/security/permissions/object', { method: 'POST', body: JSON.stringify(payload) });

export const saveFieldPermissions = (payload) =>
    apiClient('/api/security/permissions/field', { method: 'POST', body: JSON.stringify(payload) });

export const createProfileAPI = (payload) =>
    apiClient('/api/security/profiles', { method: 'POST', body: JSON.stringify(payload) });

export const createUserAPI = (payload) =>
    apiClient('/api/security/users', { method: 'POST', body: JSON.stringify(payload) });

export const deployOrchestrationPackage = (jsonPayload) =>
    apiClient('/api/metadata/orchestrate/import', { method: 'POST', body: JSON.stringify(jsonPayload) });

// ===========================================
// FAST-PATH CAPABILITY APIs
// ===========================================

export const fetchThreadMessages = async (parentObjectType, parentRecordId) => {
    const res = await apiClient(`/api/v1/inbox/${parentObjectType}/${parentRecordId}`);
    return res.data || [];
};
export const postThreadMessage = (parentObjectType, parentRecordId, text) =>
    apiClient('/api/v1/inbox/message', {
        method: 'POST',
        body: JSON.stringify({ parent_object: parentObjectType, parent_record_id: parentRecordId, body: text })
    });

export const fetchAuditLedger = async (parentObjectType, parentRecordId) => {
    const res = await apiClient(`/api/v1/audit/${parentObjectType}/${parentRecordId}`);
    return res.data || [];
};

// Add this to your METADATA & SCHEMA APIs section
export const deployFlowAPI = (payload) =>
    apiClient('/api/metadata/flows', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

export const fetchObjectFlows = (objectName) =>
    apiClient(`/api/metadata/flows/${objectName}`);

export const shareRecordAPI = (objectName, recordId, targetUserId) => {
    // Pure, clean, and relies entirely on the apiClient's centralized header injection
    return apiClient('/api/security/share', {
        method: 'POST',
        body: JSON.stringify({
            object_name: objectName,
            record_id: recordId,
            target_user_id: targetUserId,
            access_level: 'READ' 
        })
    });
};

// Add this to your FAST-PATH CAPABILITY APIs section
export const fetchRecentJobsAPI = async () => {
    // apiClient defaults to GET and handles headers/errors automatically
    const res = await apiClient('/api/v1/migration/jobs'); 
    return res || [];
};