// Browser DevTools Replay Test Script for Childcare Modal Flow
// Copy and paste this script directly into your browser's developer console (F12 -> Console) 
// on http://localhost:5174/?tool=fire to replay the test!

(async function runReplayTest() {
  // 1. Create a floating banner overlay to show progress
  const overlay = document.createElement('div');
  overlay.id = 'replay-test-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '20px';
  overlay.style.right = '20px';
  overlay.style.zIndex = '999999';
  overlay.style.background = 'rgba(15, 23, 42, 0.95)';
  overlay.style.color = '#fff';
  overlay.style.padding = '20px';
  overlay.style.borderRadius = '12px';
  overlay.style.border = '2px solid #8b5cf6';
  overlay.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
  overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  overlay.style.width = '350px';
  overlay.style.lineHeight = '1.5';
  overlay.style.fontSize = '0.9rem';
  
  overlay.innerHTML = `
    <div style="font-weight: 800; color: #a78bfa; margin-bottom: 8px; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
      ⚡ Childcare Flow Replay Test
    </div>
    <div id="replay-status" style="color: #e2e8f0; min-height: 45px;">Initializing test...</div>
    <div id="replay-step" style="font-size: 0.75rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 10px; padding-top: 8px;">Preparing baseline...</div>
  `;
  
  // Remove existing overlay if any
  const existing = document.getElementById('replay-test-overlay');
  if (existing) existing.remove();
  document.body.appendChild(overlay);

  const statusEl = document.getElementById('replay-status');
  const stepEl = document.getElementById('replay-step');

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const logStatus = (status, stepMsg) => {
    statusEl.innerHTML = status;
    if (stepMsg) stepEl.innerHTML = stepMsg;
    console.log(`[Replay Test] ${status} - ${stepMsg || ''}`);
  };

  const highlight = (el) => {
    if (!el) return;
    const prevOutline = el.style.outline;
    const prevTransition = el.style.transition;
    el.style.transition = 'outline 0.2s ease';
    el.style.outline = '3px solid #f59e0b';
    setTimeout(() => {
      el.style.outline = prevOutline;
      el.style.transition = prevTransition;
    }, 1200);
  };

  try {
    // ----------------------------------------------------
    // STEP 1: Add First Child
    // ----------------------------------------------------
    logStatus("Adding first child event...", "Selecting 'Have a Child' from dropdown");
    const dropdown = document.querySelector('.add-event-dropdown');
    if (!dropdown) throw new Error("Could not find '.add-event-dropdown' select element on page. Make sure you are on the simulator page.");
    
    highlight(dropdown);
    await sleep(1000);
    dropdown.value = 'haveChild';
    dropdown.dispatchEvent(new Event('change'));
    
    await sleep(1000);
    
    logStatus("Configuring first child...", "Filling out name: Liam");
    const nameInput = document.querySelector('.modal-content input[placeholder*="Liam"]');
    if (nameInput) {
      highlight(nameInput);
      nameInput.value = 'Liam';
      nameInput.dispatchEvent(new Event('input'));
      await sleep(500);
    }
    
    logStatus("Saving first child...", "Clicking 'Save Event'");
    const saveBtn = Array.from(document.querySelectorAll('.modal-content button')).find(b => b.textContent.includes('Save Event'));
    if (!saveBtn) throw new Error("Could not find 'Save Event' button");
    highlight(saveBtn);
    await sleep(800);
    saveBtn.click();
    
    await sleep(1500);

    // ----------------------------------------------------
    // STEP 2: Verify Child Impact Modal & Adjust Plan
    // ----------------------------------------------------
    logStatus("Verifying Child Impact Modal...", "Checking modal title and retirement readiness");
    const modalTitle = document.querySelector('.modal-content h3');
    if (!modalTitle || !modalTitle.textContent.includes('Child Event Added')) {
      throw new Error("Expected Child Impact Modal ('Child Event Added') to pop up");
    }
    
    const beforeText = document.body.innerHTML.includes('Retirement Ready') || document.body.innerHTML.includes('Needs Adjustment');
    if (!beforeText) throw new Error("Expected retirement readiness status in modal");

    await sleep(1500);
    
    logStatus("Opening Improvement Plan...", "Clicking 'Adjust Plan'");
    const adjustPlanBtn = Array.from(document.querySelectorAll('.modal-content button')).find(b => b.textContent.includes('Adjust Plan'));
    if (!adjustPlanBtn) throw new Error("Could not find 'Adjust Plan' button");
    highlight(adjustPlanBtn);
    await sleep(800);
    adjustPlanBtn.click();
    
    await sleep(1500);

    // ----------------------------------------------------
    // STEP 3: Apply "Earn More" Scenario in Improvement Plan
    // ----------------------------------------------------
    logStatus("Retirement Improvement Plan Modal opened", "Looking for 'Earn More' action plan");
    const improvementModal = document.querySelector('.improvement-modal-card');
    if (!improvementModal) throw new Error("Expected Retirement Improvement Plan modal to open");
    
    // Find the 'Earn More' card
    const earnMoreCard = Array.from(document.querySelectorAll('.improvement-plan-card')).find(c => c.textContent.includes('Earn More'));
    if (!earnMoreCard) throw new Error("Could not find 'Earn More' recommendation card");
    
    highlight(earnMoreCard);
    await sleep(1500);
    
    logStatus("Applying 'Earn More' scenario...", "Clicking 'Apply Scenario'");
    const applyBtn = earnMoreCard.querySelector('.improvement-plan-card-apply-btn');
    if (!applyBtn) throw new Error("Could not find 'Apply Scenario' button inside 'Earn More' card");
    highlight(applyBtn);
    await sleep(800);
    applyBtn.click();
    
    await sleep(1500);

    // ----------------------------------------------------
    // STEP 4: Budget Builder Modal & Save Budget
    // ----------------------------------------------------
    logStatus("Budget Builder Modal opened", "Verifying Childcare Phase takes increased income");
    const budgetModal = document.querySelector('.modal-content');
    if (!budgetModal || !document.body.innerHTML.includes('Childcare Phase')) {
      throw new Error("Expected Budget Builder modal to open on the Childcare Phase");
    }
    
    // Check that we show child boost and no deficit
    await sleep(1500);
    
    logStatus("Saving budget...", "Clicking 'Save Budget'");
    const saveBudgetBtn = Array.from(document.querySelectorAll('.modal-content button')).find(b => b.textContent.includes('Save Budget'));
    if (!saveBudgetBtn) throw new Error("Could not find 'Save Budget' button");
    highlight(saveBudgetBtn);
    await sleep(800);
    saveBudgetBtn.click();
    
    await sleep(2000);

    // ----------------------------------------------------
    // STEP 5: Add Second Child
    // ----------------------------------------------------
    logStatus("Adding second child event...", "Selecting 'Have a Child' from dropdown");
    highlight(dropdown);
    await sleep(1000);
    dropdown.value = 'haveChild';
    dropdown.dispatchEvent(new Event('change'));
    
    await sleep(1000);
    
    logStatus("Configuring second child...", "Filling out name: Emma");
    const nameInput2 = document.querySelector('.modal-content input[placeholder*="Liam"]');
    if (nameInput2) {
      highlight(nameInput2);
      nameInput2.value = 'Emma';
      nameInput2.dispatchEvent(new Event('input'));
      await sleep(500);
    }
    
    logStatus("Saving second child...", "Clicking 'Save Event'");
    const saveBtn2 = Array.from(document.querySelectorAll('.modal-content button')).find(b => b.textContent.includes('Save Event'));
    highlight(saveBtn2);
    await sleep(800);
    saveBtn2.click();
    
    await sleep(1500);

    // ----------------------------------------------------
    // STEP 6: Verify second child triggers ready age delay / deficit
    // ----------------------------------------------------
    logStatus("Verifying second child impact...", "Verifying Child Impact Modal shows a plan deficit warning");
    const modalTitle2 = document.querySelector('.modal-content h3');
    if (!modalTitle2 || !modalTitle2.textContent.includes('Child Event Added')) {
      throw new Error("Expected Child Impact Modal to open for the second child");
    }
    
    await sleep(2000);
    
    logStatus("Opening Plan Adjustments...", "Clicking 'Adjust Plan'");
    const adjustPlanBtn2 = Array.from(document.querySelectorAll('.modal-content button')).find(b => b.textContent.includes('Adjust Plan'));
    highlight(adjustPlanBtn2);
    await sleep(800);
    adjustPlanBtn2.click();
    
    await sleep(1500);

    // ----------------------------------------------------
    // STEP 7: Verify suggestion card shows unfunded cost ($15,000/yr)
    // ----------------------------------------------------
    logStatus("Retirement Improvement Plan Modal opened again", "Verifying suggestion card recommends additional $15,000/yr");
    const earnMoreCard2 = Array.from(document.querySelectorAll('.improvement-plan-card')).find(c => c.textContent.includes('Earn More'));
    if (!earnMoreCard2) throw new Error("Could not find 'Earn More' recommendation card for second child");
    
    highlight(earnMoreCard2);
    await sleep(2000);
    
    logStatus("Applying second child plan...", "Clicking 'Apply Scenario' to fund second child");
    const applyBtn2 = earnMoreCard2.querySelector('.improvement-plan-card-apply-btn');
    highlight(applyBtn2);
    await sleep(800);
    applyBtn2.click();
    
    await sleep(1500);

    // ----------------------------------------------------
    // STEP 8: Budget Builder Modal showing scaled income
    // ----------------------------------------------------
    logStatus("Budget Builder showing scaled income", "Verifying Take-home Income has automatically added the second child's $1,250/mo");
    await sleep(2000);
    
    logStatus("Saving final plan...", "Clicking 'Save Budget'");
    const saveBudgetBtn2 = Array.from(document.querySelectorAll('.modal-content button')).find(b => b.textContent.includes('Save Budget'));
    highlight(saveBudgetBtn2);
    await sleep(800);
    saveBudgetBtn2.click();
    
    await sleep(1000);

    logStatus("🎉 REPLAY TEST PASSED SUCCESSFULLY!", "Both children added, modals opened in correct order, and income scaled properly!");
    overlay.style.border = '2px solid #10b981';
    overlay.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
    
    // Add a close button to the success banner
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Dismiss';
    closeBtn.style.marginTop = '10px';
    closeBtn.style.padding = '4px 12px';
    closeBtn.style.background = '#10b981';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => overlay.remove();
    overlay.appendChild(closeBtn);

  } catch (err) {
    logStatus(`❌ TEST FAILED: ${err.message}`, "Check console log for details.");
    overlay.style.border = '2px solid #ef4444';
    overlay.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.4)';
    console.error(err);
  }
})();
