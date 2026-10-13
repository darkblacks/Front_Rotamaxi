<script setup>
defineProps({
    colunas: { type: Array, required: true },
    larguraMinima: { type: Number, default: 780 },
    alturaMaxima: { type: String, default: '' },
});
</script>

<template>
    <div class="tabela" :style="alturaMaxima ? { maxHeight: alturaMaxima } : null">
        <table class="tabela__grade" :style="{ minWidth: `${larguraMinima}px` }">
            <thead class="tabela__cabecalho">
                <tr>
                    <th
                        v-for="coluna in colunas"
                        :key="coluna.chave"
                        :style="{ width: coluna.largura ?? 'auto', textAlign: coluna.alinhamento ?? 'left' }"
                        scope="col"
                    >
                        {{ coluna.rotulo }}
                    </th>
                </tr>
            </thead>
            <tbody>
                <slot />
            </tbody>
        </table>
    </div>
</template>

<style scoped src="@/styles/components/all/tables/base_table.css"></style>
