"use client";
import { useEffect } from "react";

export default function UrlAutoFill() {
  useEffect(() => {
    // subdomain → cim_url
    const subdomainInput = document.getElementById("subdomain") as HTMLInputElement | null;
    const cimUrlInput = document.getElementById("cim_url") as HTMLInputElement | null;
    if (subdomainInput && cimUrlInput) {
      subdomainInput.addEventListener("input", () => {
        cimUrlInput.value = subdomainInput.value
          ? `https://${subdomainInput.value}.cloudimanage.com`
          : "https://cloudimanage.com";
        // cascade into cim_site
        const cimSiteInput = document.getElementById("cim_site") as HTMLInputElement | null;
        if (cimSiteInput) cimSiteInput.value = cimUrlInput.value.replace(/^https?:\/\//, "");
      });
    }

    // URL → site name (also fires when user edits the URL directly)
    function wireUrlToSite(urlId: string, siteId: string) {
      const urlInput = document.getElementById(urlId) as HTMLInputElement | null;
      const siteInput = document.getElementById(siteId) as HTMLInputElement | null;
      if (!urlInput || !siteInput) return;
      urlInput.addEventListener("input", () => {
        siteInput.value = urlInput.value.replace(/^https?:\/\//, "");
      });
    }

    wireUrlToSite("cim_url", "cim_site");
    wireUrlToSite("work_url", "work_site");
  }, []);

  return null;
}
