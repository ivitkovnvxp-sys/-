// main.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#packingForm');
    const customBoxSizeFields = document.querySelector('.custom-box-size-fields');
    const boxSizeSelect = document.getElementById('boxSizeSelect');

    function toggleCustomBoxSizeFields(value) {
        if (value === 'custom') {
            customBoxSizeFields.classList.remove('hidden');
            customBoxSizeFields.classList.add('shown');
        } else {
            customBoxSizeFields.classList.remove('shown');
            customBoxSizeFields.classList.add('hidden');
        }
    }

    boxSizeSelect.addEventListener('change', (event) => {
        toggleCustomBoxSizeFields(event.target.value);
    });

    // Главная логика формы остается той же
    form.addEventListener('submit', handleSubmit);

    function handleSubmit(event) {
        event.preventDefault();

        const selectedOption = boxSizeSelect.value;

        let boxWidth, boxLength, boxHeight;

        switch(selectedOption) {
            case 'small':
                boxWidth = 250;
                boxLength = 250;
                boxHeight = 230;
                break;
            case 'medium':
                boxWidth = 300;
                boxLength = 300;
                boxHeight = 300;
                break;
            case 'large':
                boxWidth = 380;
                boxLength = 380;
                boxHeight = 380;
                break;
           case 'big':
                boxWidth = 470;
                boxLength = 460;
                boxHeight = 460;
                break;
           case 'mega':
                boxWidth = 930;
                boxLength = 560;
                boxHeight = 680;
                break;
            case 'custom': // Здесь берём значения из пользовательских полей
                boxWidth = Number(form.boxWidth.value);
                boxLength = Number(form.boxLength.value);
                boxHeight = Number(form.boxHeight.value);
                break;
            default:
                alert("Выберите подходящий размер коробки или введите свой размер.");
                return;
        }

        const itemWidth = Number(form.itemWidth.value);
        const itemLength = Number(form.itemLength.value);
        const itemHeight = Number(form.itemHeight.value);
        const totalItems = Number(form.totalItems.value);

        let itemsPerBox = Math.floor((boxWidth / itemWidth)) * Math.floor((boxLength / itemLength)) * Math.floor((boxHeight / itemHeight));

        if (itemsPerBox <= 0 || isNaN(itemsPerBox)) {
            alert("Ошибка: размеры товара превышают размеры выбранной коробки");
            return;
        }

        const boxesNeeded = Math.ceil(totalItems / itemsPerBox);

        const outputText = `
            <strong>Размеры коробки:</strong><br />
            Ширина: ${boxWidth} мм × Длина: ${boxLength} мм × Высота: ${boxHeight} мм<br /><br />
            
            <strong>Размеры товара:</strong><br />
            Ширина: ${itemWidth} мм × Длина: ${itemLength} мм × Высота: ${itemHeight} мм<br /><br />
            
            <strong>Расчёт:</strong><br />
            Количество товаров в одной коробке: ${itemsPerBox}<br />
            Необходимое количество коробок: ${boxesNeeded}<br />
        `;

        document.getElementById('outputResult').innerHTML = outputText;
    }
});