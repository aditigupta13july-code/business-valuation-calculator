declare var html2canvas: any;

// --- DATA ---
const industryMultiples = {
    sde: {
        'automotive': 3.0, 'business-services': 3.5, 'construction': 3.25, 'consumer-goods': 3.8,
        'e-commerce': 3.75, 'education': 4.0, 'financial-services': 4.5, 'food-beverage': 3.2,
        'healthcare': 4.25, 'hospitality': 3.0, 'logistics': 3.5, 'manufacturing': 4.25,
        'media': 3.8, 'real-estate': 4.0, 'restaurants': 3.0, 'retail': 3.0, 'saas': 5.0,
        'software': 4.8, 'tech-hardware': 4.0, 'telecom': 4.5
    },
    ebitda: {
        'automotive': 4.0, 'business-services': 5.5, 'construction': 3.7, 'consumer-goods': 6.0,
        'e-commerce': 7.1, 'education': 6.5, 'financial-services': 7.5, 'food-beverage': 4.0,
        'healthcare': 4.3, 'hospitality': 4.5, 'logistics': 5.0, 'manufacturing': 5.4,
        'media': 6.8, 'real-estate': 6.2, 'restaurants': 2.4, 'retail': 4.5, 'saas': 8.8,
        'software': 8.5, 'tech-hardware': 6.0, 'telecom': 7.0
    }
};

let currentTab = 'basic';

// --- FUNCTIONS ---
function changeTab(tabName) {
    currentTab = tabName;
    ['basic', 'intermediate', 'advanced'].forEach(tab => {
        document.getElementById(`form-${tab}`).classList.add('hidden');
        document.getElementById(`tab-${tab}`).classList.remove('tab-active');
        document.getElementById(`preview-${tab}`).classList.add('hidden');
        document.getElementById(`guide-${tab}`).classList.add('hidden');
        document.getElementById(`definitions-${tab}`).classList.add('hidden');
    });
    document.getElementById(`form-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
    document.getElementById(`preview-${tabName}`).classList.remove('hidden');
    document.getElementById(`guide-${tabName}`).classList.remove('hidden');
    document.getElementById(`definitions-${tabName}`).classList.remove('hidden');

    if (currentTab !== 'advanced') {
        updatePreview();
    }
}

function getVal(id: string): number {
    const element = document.getElementById(id) as HTMLInputElement;
    if (element) {
        return parseFloat(element.value) || 0;
    }
    return 0;
}

function formatCurrency(value) {
    if (isNaN(value) || value === 0) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function createMetricItem(label, value) {
    const item = document.createElement('div');
    item.className = 'metric-item flex justify-between items-center';
    item.innerHTML = `<span class="text-gray-600">${label}</span><span class="font-bold text-gray-900">${value}</span>`;
    return item;
}


function calculateDCF(isPreview = false) {
    const revenue = getVal('adv-revenue');
    const cogs = getVal('adv-cogs');
    const opex = getVal('adv-opex');
    const taxRate = getVal('adv-tax-rate') / 100;
    const growthRate1 = getVal('adv-growth-rate-1') / 100;
    const growthRate2 = getVal('adv-growth-rate-2') / 100;
    const discountRate = parseFloat((document.getElementById('adv-risk') as HTMLSelectElement).value);
    const capexPercent = getVal('adv-capex') / 100;
    const daPercent = getVal('adv-da') / 100;
    const nwcPercent = getVal('adv-nwc') / 100;
    const terminalGrowthRate = getVal('adv-terminal-growth') / 100;
    const debt = getVal('adv-debt');
    const cash = getVal('adv-cash');

    const valuationContainer = document.getElementById('preview-adv-valuation');
    const metricsContainer = document.getElementById('metrics-advanced');
    const initialPlaceholder = '<p class="col-span-2 text-center text-gray-500 italic">Enter your data and click "Calculate" to see key metrics.</p>';
    
    // Improved Validation
    if (revenue <= 0) {
        if (isPreview) {
            valuationContainer.innerHTML = `<span class="text-xl font-bold text-red-600">Revenue must be positive.</span>`;
            updateGraph('adv', 0, 0);
            metricsContainer.innerHTML = initialPlaceholder;
        }
        return { valuation: 0 };
    }
    
    const ebit = revenue - cogs - opex;
    if (ebit <= 0) {
        if (isPreview) {
            valuationContainer.innerHTML = `<span class="text-xl font-bold text-red-600">Valuation not possible with negative initial profit (EBIT).</span>`;
            updateGraph('adv', 0, 0);
            metricsContainer.innerHTML = initialPlaceholder;
        }
        return { valuation: 0 };
    }

    if (discountRate <= terminalGrowthRate) {
        if (isPreview) {
            valuationContainer.innerHTML = `<span class="text-xl font-bold text-red-600">Discount Rate must be higher than Perpetual Growth Rate.</span>`;
            updateGraph('adv', 0, 0);
            metricsContainer.innerHTML = initialPlaceholder;
        }
        return { valuation: 0 };
    }

    // --- Core DCF Logic ---
    let presentValueSum = 0;
    let currentRevenue = revenue;

    // Calculate cost percentages based on initial inputs
    const cogsPercent = cogs / revenue;
    const opexPercent = opex / revenue;

    for (let i = 1; i <= 5; i++) {
        const growthRate = i <= 2 ? growthRate1 : growthRate2;
        const previousRevenue = currentRevenue;
        currentRevenue *= (1 + growthRate);
        
        // Project EBIT based on revenue and constant cost structure
        const projectedEbit = currentRevenue * (1 - cogsPercent - opexPercent);

        const nopat = projectedEbit * (1 - taxRate);
        const capex = currentRevenue * capexPercent;
        const da = currentRevenue * daPercent;
        const deltaNwc = (currentRevenue - previousRevenue) * nwcPercent;
        const fcf = nopat + da - capex - deltaNwc;
        
        presentValueSum += fcf / Math.pow(1 + discountRate, i);
    }
    
    const terminalRevenue = currentRevenue * (1 + terminalGrowthRate);
    const terminalEbit = terminalRevenue * (1 - cogsPercent - opexPercent);
    const terminalNopat = terminalEbit * (1 - taxRate);
    const terminalCapex = terminalRevenue * capexPercent;
    const terminalDa = terminalRevenue * daPercent;
    const terminalDeltaNwc = (terminalRevenue - currentRevenue) * nwcPercent;
    const terminalFcf = terminalNopat + terminalDa - terminalCapex - terminalDeltaNwc;

    const terminalValue = terminalFcf / (discountRate - terminalGrowthRate);
    const presentTerminalValue = terminalValue / Math.pow(1 + discountRate, 5);
    
    const enterpriseValue = presentValueSum + presentTerminalValue;
    const equityValue = enterpriseValue - debt + cash; // Corrected Equity Value calculation

    if (isPreview) {
        if (equityValue <= 0) {
            valuationContainer.innerHTML = `<span class="text-2xl font-bold text-blue-600">₹0</span>`;
            updateGraph('adv', 0, 0);
            metricsContainer.innerHTML = '<p class="col-span-2 text-center text-gray-500 italic">Valuation is not positive. Please adjust your financial inputs.</p>';
        } else {
             const lowerBound = equityValue * 0.9;
             const upperBound = equityValue * 1.1;
             valuationContainer.innerHTML = `
                <span class="text-2xl font-bold text-blue-600">${formatCurrency(lowerBound)}</span>
                <span class="text-xl font-semibold text-gray-500 mx-1">-</span>
                <span class="text-2xl font-bold text-blue-600">${formatCurrency(upperBound)}</span>
             `;
             updateGraph('adv', lowerBound, upperBound);

             metricsContainer.innerHTML = '';
             metricsContainer.appendChild(createMetricItem('Enterprise Value', formatCurrency(enterpriseValue)));
             metricsContainer.appendChild(createMetricItem('+ Cash', formatCurrency(cash)));
             metricsContainer.appendChild(createMetricItem('- Debt', formatCurrency(debt)));
             metricsContainer.appendChild(createMetricItem('Equity Value', formatCurrency(equityValue)));
             metricsContainer.appendChild(createMetricItem('Discount Rate', `${(discountRate * 100).toFixed(1)}%`));
             metricsContainer.appendChild(createMetricItem('Terminal Growth', `${(terminalGrowthRate * 100).toFixed(1)}%`));
        }
    }

    return { valuation: equityValue > 0 ? equityValue : 0 };
}

function updateGraph(tabPrefix, lowerBound, upperBound) {
    const lowerValueEl = document.getElementById(`graph-${tabPrefix}-lower-value`);
    const upperValueEl = document.getElementById(`graph-${tabPrefix}-upper-value`);
    const lowerBarEl = document.getElementById(`graph-${tabPrefix}-lower-bar`);
    const upperBarEl = document.getElementById(`graph-${tabPrefix}-upper-bar`);

    if (lowerValueEl && upperValueEl && lowerBarEl && upperBarEl) {
        lowerValueEl.textContent = formatCurrency(lowerBound);
        upperValueEl.textContent = formatCurrency(upperBound);
        
        if (upperBound > 0) {
            const lowerPercentage = (lowerBound / upperBound) * 100;
            lowerBarEl.style.width = `${lowerPercentage}%`;
            upperBarEl.style.width = '100%';
        } else {
            lowerBarEl.style.width = '0%';
            upperBarEl.style.width = '0%';
        }
    }
}

function updatePreview() {
    if (currentTab === 'basic') {
        const revenue = getVal('basic-revenue');
        const cogs = getVal('basic-cogs');
        const opex = getVal('basic-opex');
        const ownerSalary = getVal('basic-owner-salary');
        const interest = getVal('basic-interest');
        const depreciation = getVal('basic-depreciation');
        const oneTimeExpenses = getVal('basic-one-time-expenses');
        
        const preTaxIncome = revenue - cogs - opex;
        const totalAddBacks = ownerSalary + interest + depreciation + oneTimeExpenses;
        const sde = preTaxIncome + totalAddBacks;
        
        const industry = (document.getElementById('basic-industry') as HTMLSelectElement).value;
        const baseMultiple = industryMultiples.sde[industry] || 0;
        const trendAdjustment = parseFloat((document.getElementById('basic-revenue-trend') as HTMLSelectElement).value);
        const adjustedMultiple = baseMultiple + trendAdjustment;

        const valuation = sde * adjustedMultiple;
        const lowerBound = valuation * 0.9;
        const upperBound = valuation * 1.1;

        const valuationContainer = document.getElementById('preview-basic-valuation');
        const metricsContainer = document.getElementById('metrics-basic');

        if (valuation > 0) {
            valuationContainer.innerHTML = `
                <span class="text-2xl font-bold text-blue-600">${formatCurrency(lowerBound)}</span>
                <span class="text-xl font-semibold text-gray-500 mx-1">-</span>
                <span class="text-2xl font-bold text-blue-600">${formatCurrency(upperBound)}</span>
            `;
        } else {
             valuationContainer.innerHTML = `<span class="text-2xl font-bold text-blue-600">₹0</span>`;
        }
        
        updateGraph('basic', lowerBound, upperBound);
        metricsContainer.innerHTML = '';
        metricsContainer.appendChild(createMetricItem('SDE', formatCurrency(sde)));
        metricsContainer.appendChild(createMetricItem('Multiple', `${adjustedMultiple.toFixed(2)}x`));
        metricsContainer.appendChild(createMetricItem('Pre-Tax Profit', formatCurrency(preTaxIncome)));
        metricsContainer.appendChild(createMetricItem('Add-Backs', formatCurrency(totalAddBacks)));


    } else if (currentTab === 'intermediate') {
        const ebitda = getVal('int-ebitda');
        const debt = getVal('int-debt');
        const cash = getVal('int-cash');
        const industry = (document.getElementById('int-industry') as HTMLSelectElement).value;
        const baseMultiple = industryMultiples.ebitda[industry] || 0;
        
        let multipleAdjustment = 0;
        document.querySelectorAll('.int-factor:checked').forEach(cb => {
            multipleAdjustment += parseFloat((cb as HTMLInputElement).value);
        });
        const adjustedMultiple = baseMultiple + multipleAdjustment;
        const enterpriseValue = ebitda * adjustedMultiple;
        const equityValue = enterpriseValue - debt + cash;
        const netDebt = debt - cash;
        const lowerBound = equityValue * 0.9;
        const upperBound = equityValue * 1.1;

        const valuationContainer = document.getElementById('preview-int-valuation');
        const metricsContainer = document.getElementById('metrics-intermediate');

        if (equityValue > 0) {
            valuationContainer.innerHTML = `
                <span class="text-2xl font-bold text-blue-600">${formatCurrency(lowerBound)}</span>
                <span class="text-xl font-semibold text-gray-500 mx-1">-</span>
                <span class="text-2xl font-bold text-blue-600">${formatCurrency(upperBound)}</span>
            `;
        } else {
             valuationContainer.innerHTML = `<span class="text-2xl font-bold text-blue-600">₹0</span>`;
        }
        
        updateGraph('int', lowerBound, upperBound);
        metricsContainer.innerHTML = '';
        metricsContainer.appendChild(createMetricItem('EBITDA', formatCurrency(ebitda)));
        metricsContainer.appendChild(createMetricItem('Adj. Multiple', `${adjustedMultiple.toFixed(2)}x`));
        metricsContainer.appendChild(createMetricItem('Enterprise Value', formatCurrency(enterpriseValue)));
        metricsContainer.appendChild(createMetricItem('Less: Net Debt', formatCurrency(netDebt)));
        metricsContainer.appendChild(createMetricItem('Equity Value', formatCurrency(equityValue)));
    }
}

// --- PDF Download Enhancement ---
const modal = document.getElementById('download-modal');
const modalStatus = document.getElementById('download-status-text');

function showDownloadModal() {
    modal.classList.remove('hidden');
}

function hideDownloadModal() {
    modal.classList.add('hidden');
}

function updateDownloadStatus(text) {
    modalStatus.textContent = text;
}

function populatePdfDetails(tabName) {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById(`pdf-date-${tabName}`).textContent = dateString;

    if (tabName === 'basic') {
        const industryEl = document.getElementById('basic-industry') as HTMLSelectElement;
        document.getElementById('pdf-basic-input-industry').textContent = industryEl.options[industryEl.selectedIndex].text;
        document.getElementById('pdf-basic-input-revenue').textContent = formatCurrency(getVal('basic-revenue'));
        document.getElementById('pdf-basic-input-cogs').textContent = formatCurrency(getVal('basic-cogs'));
        document.getElementById('pdf-basic-input-opex').textContent = formatCurrency(getVal('basic-opex'));
        document.getElementById('pdf-basic-input-owner-salary').textContent = formatCurrency(getVal('basic-owner-salary'));
        document.getElementById('pdf-basic-input-interest').textContent = formatCurrency(getVal('basic-interest'));
        document.getElementById('pdf-basic-input-depreciation').textContent = formatCurrency(getVal('basic-depreciation'));
        document.getElementById('pdf-basic-input-one-time-expenses').textContent = formatCurrency(getVal('basic-one-time-expenses'));
        const trendEl = document.getElementById('basic-revenue-trend') as HTMLSelectElement;
        document.getElementById('pdf-basic-input-revenue-trend').textContent = trendEl.options[trendEl.selectedIndex].text;
    } else if (tabName === 'intermediate') {
        const industryEl = document.getElementById('int-industry') as HTMLSelectElement;
        document.getElementById('pdf-int-input-industry').textContent = industryEl.options[industryEl.selectedIndex].text;
        document.getElementById('pdf-int-input-ebitda').textContent = formatCurrency(getVal('int-ebitda'));
        document.getElementById('pdf-int-input-debt').textContent = formatCurrency(getVal('int-debt'));
        document.getElementById('pdf-int-input-cash').textContent = formatCurrency(getVal('int-cash'));
        const factors = [];
        document.querySelectorAll('.int-factor:checked').forEach(cb => {
            factors.push(cb.nextElementSibling.textContent.trim());
        });
        document.getElementById('pdf-int-input-factors').textContent = factors.length > 0 ? factors.join(', ') : 'None selected';
    } else if (tabName === 'advanced') {
        document.getElementById('pdf-adv-input-revenue').textContent = formatCurrency(getVal('adv-revenue'));
        document.getElementById('pdf-adv-input-cogs').textContent = formatCurrency(getVal('adv-cogs'));
        document.getElementById('pdf-adv-input-opex').textContent = formatCurrency(getVal('adv-opex'));
        document.getElementById('pdf-adv-input-tax-rate').textContent = `${getVal('adv-tax-rate')}%`;
        document.getElementById('pdf-adv-input-debt').textContent = formatCurrency(getVal('adv-debt'));
        document.getElementById('pdf-adv-input-cash').textContent = formatCurrency(getVal('adv-cash'));
        document.getElementById('pdf-adv-input-g1').textContent = `${getVal('adv-growth-rate-1')}%`;
        document.getElementById('pdf-adv-input-g2').textContent = `${getVal('adv-growth-rate-2')}%`;
        document.getElementById('pdf-adv-input-capex').textContent = `${getVal('adv-capex')}%`;
        document.getElementById('pdf-adv-input-da').textContent = `${getVal('adv-da')}%`;
        document.getElementById('pdf-adv-input-nwc').textContent = `${getVal('adv-nwc')}%`;
        const riskEl = document.getElementById('adv-risk') as HTMLSelectElement;
        document.getElementById('pdf-adv-input-wacc').textContent = riskEl.options[riskEl.selectedIndex].text;
        document.getElementById('pdf-adv-input-terminal').textContent = `${getVal('adv-terminal-growth')}%`;
    }
}


async function downloadPdf(tabName) {
    const reportElement = document.getElementById(`valuation-report-${tabName}`);
    const detailsElement = document.getElementById(`pdf-details-${tabName}`);
    const footerElement = document.getElementById(`pdf-footer-${tabName}`);
    const downloadButton = document.getElementById(`download-pdf-${tabName}`);
    
    if (!reportElement || !detailsElement || !footerElement || !downloadButton) return;

    downloadButton.setAttribute('disabled', 'true');
    showDownloadModal();
    
    try {
        // Step 1: Populate, reveal details, and apply PDF-specific styles
        updateDownloadStatus('Step 1/3: Preparing document...');
        populatePdfDetails(tabName);
        detailsElement.classList.remove('hidden');
        footerElement.classList.remove('hidden');
        reportElement.classList.add('pdf-render-mode'); // Apply special styles for rendering
        await new Promise(resolve => setTimeout(resolve, 100)); // allow DOM to update

        // Step 2: Generate the canvas
        updateDownloadStatus('Step 2/3: Creating high-resolution canvas...');
        const canvas = await html2canvas(reportElement, { 
            scale: 2.5, // Higher scale for sharper text
            useCORS: true, 
            backgroundColor: '#ffffff'
        });
        
        // Step 3: Create and save the PDF
        updateDownloadStatus('Step 3/3: Assembling PDF file...');
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = (window as any).jspdf;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`Razorpay-Valuation-Report-${tabName}.pdf`);
        updateDownloadStatus('Success! Your download will begin shortly.');

    } catch (error) {
        console.error("Error generating PDF:", error);
        updateDownloadStatus('An error occurred. Please try again.');
    } finally {
        // Clean up: remove styles, hide details, close modal
        reportElement.classList.remove('pdf-render-mode'); // IMPORTANT: Remove the class to restore original view
        setTimeout(() => {
            detailsElement.classList.add('hidden');
            footerElement.classList.add('hidden');
            hideDownloadModal();
            downloadButton.removeAttribute('disabled');
        }, 2000);
    }
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners for tab changes
    document.getElementById('tab-basic').addEventListener('click', () => changeTab('basic'));
    document.getElementById('tab-intermediate').addEventListener('click', () => changeTab('intermediate'));
    document.getElementById('tab-advanced').addEventListener('click', () => changeTab('advanced'));

    // Add event listener for DCF calculation
    document.getElementById('dcf-calculate-button').addEventListener('click', () => calculateDCF(true));
    
    // Add event listeners for PDF download
    document.getElementById('download-pdf-basic').addEventListener('click', () => downloadPdf('basic'));
    document.getElementById('download-pdf-intermediate').addEventListener('click', () => downloadPdf('intermediate'));
    document.getElementById('download-pdf-advanced').addEventListener('click', () => downloadPdf('advanced'));
    
    // Add event listeners for input changes
    document.querySelectorAll('#form-basic input, #form-basic select, #form-intermediate input, #form-intermediate select').forEach(element => {
        element.addEventListener('input', updatePreview);
    });

    // FAQ Accordion Logic
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const button = item.querySelector('.faq-question') as HTMLElement;
        const answer = item.querySelector('.faq-answer') as HTMLElement;

        if (button && answer) {
            button.addEventListener('click', () => {
                const isExpanded = button.getAttribute('aria-expanded') === 'true';

                // Close all other items before toggling the current one
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                        const otherButton = otherItem.querySelector('.faq-question') as HTMLElement;
                        const otherAnswer = otherItem.querySelector('.faq-answer') as HTMLElement;
                        if (otherButton && otherAnswer) {
                            otherButton.setAttribute('aria-expanded', 'false');
                            otherAnswer.style.maxHeight = '0px';
                        }
                    }
                });

                // Toggle the current item
                item.classList.toggle('active');
                button.setAttribute('aria-expanded', String(!isExpanded));

                if (!isExpanded) {
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                } else {
                    answer.style.maxHeight = '0px';
                }
            });
        }
    });


    changeTab('basic'); // Initialize the first tab and preview
});